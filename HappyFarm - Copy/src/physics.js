// physics.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class PhysicsManager {
    constructor(scene) {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0); // Trọng lực theo trục Y
        this.world.broadphase = new CANNON.SAPBroadphase(this.world); // Tối ưu hóa va chạm
        this.world.allowSleep = true; // Cho phép vật thể "ngủ" khi không di chuyển

        this.threeToCannon = new THREE.Vector3(); // Helpers for conversion
        this.cannonToThree = new CANNON.Vec3();
        
        this.bodies = []; // Danh sách các Cannon.Body
        this.meshes = []; // Danh sách các Three.Mesh tương ứng (giữ reference)

        this.collisionListeners = []; // Để lắng nghe các sự kiện va chạm
    }

    /**
     * Thêm một Three.Mesh vào Cannon.js World.
     * Mesh phải có userData.mass, userData.cannonShapeType, và các thuộc tính liên quan khác.
     * @param {THREE.Object3D} mesh The Three.js mesh to add to the physics world.
     */
    addBody(mesh) {
        let shape;
        let mass = mesh.userData.mass || 0;
        const initialPosition = new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z);

        switch (mesh.userData.cannonShapeType) {
            case 'Box':
                const halfExtents = mesh.userData.cannonHalfExtents || new THREE.Vector3(0.5, 0.5, 0.5);
                shape = new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z));
                break;
            case 'Sphere':
                const radius = mesh.userData.cannonRadius || 0.5;
                shape = new CANNON.Sphere(radius);
                break;
            case 'Cylinder':
                const cylRadius = mesh.userData.cannonRadius || 0.5;
                const cylHeight = mesh.userData.cannonHeight || 1;
                const cylSegments = mesh.userData.cannonNumSegments || 12;
                // Cannon.js Cylinder uses radiusTop, radiusBottom, height, numSegments
                shape = new CANNON.Cylinder(cylRadius, cylRadius, cylHeight, cylSegments);
                // Three.js cylinders are aligned with Y, Cannon.js cylinders are aligned with X by default.
                // You might need to rotate the shape's orientation in the body later if it causes issues.
                break;
            case 'Plane': // Ground
                shape = new CANNON.Plane();
                break;
            case 'Trimesh': // For complex models like Farm
                // Tạo Trimesh từ geometry của mesh
                // Đây là phần phức tạp hơn, có thể cần truy cập trực tiếp geometry của mesh con
                // Ví dụ: mesh.geometry.attributes.position.array
                // Đối với mô hình phức tạp, bạn nên sử dụng một thư viện tiện ích như 'three-to-cannon'
                // hoặc tạo Trimesh từ dữ liệu đỉnh nếu bạn chắc chắn cấu trúc.
                // Tạm thời, chúng ta sẽ bỏ qua Trimesh cho Farm và xem xét dùng Plane hoặc ConvexPolyhedron nếu đơn giản hơn.
                // Hoặc nếu Farm là tĩnh, chỉ cần dùng Plane nếu nó phẳng.
                // Cho mục đích ví dụ này, Farm sẽ vẫn là Three.Mesh, không có Cannon.Body nếu nó quá phức tạp
                console.warn("Trimesh shape not fully implemented. Consider simplifying Farm for physics.");
                return; // Không thêm body nếu không xử lý được
            default:
                console.warn(`Unsupported Cannon.js shape type: ${mesh.userData.cannonShapeType}`);
                return;
        }

        const body = new CANNON.Body({ mass: mass, shape: shape, position: initialPosition });
        
        // Cần xử lý xoay cho Plane và Cylinder nếu cần
        if (mesh.userData.cannonShapeType === 'Plane') {
            // Plane trong Cannon.js mặc định hướng theo Z. Cần xoay để nó nằm ngang (hướng lên Y)
            body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        }
        if (mesh.userData.cannonShapeType === 'Cylinder') {
            // Three.js cylinder trục Y, Cannon.js cylinder trục X
            body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        }


        this.world.addBody(body);
        this.bodies.push(body);
        this.meshes.push(mesh); // Giữ reference đến Three.Mesh

        // Lưu reference đến Cannon.Body trong Three.Mesh.userData
        mesh.userData.cannonBody = body;
    }

    /**
     * Cập nhật trạng thái của Cannon.js World và đồng bộ với Three.js meshes.
     * @param {number} deltaTime Thời gian trôi qua kể từ frame trước.
     */
    update(deltaTime) {
        this.world.step(1 / 60, deltaTime, 3); // Bước vật lý: fixed timestep, deltaTime, maxSubSteps

        // Đồng bộ vị trí và xoay từ Cannon.js Body sang Three.js Mesh
        for (let i = 0; i < this.bodies.length; i++) {
            const body = this.bodies[i];
            const mesh = this.meshes[i];

            mesh.position.copy(body.position);
            mesh.quaternion.copy(body.quaternion);

            // Cập nhật vị trí và xoay cho debug BBox nếu có
            if (mesh.userData.debugBBox) {
                mesh.userData.debugBBox.position.copy(body.position);
                mesh.userData.debugBBox.quaternion.copy(body.quaternion);
            }

            // Xử lý các trường hợp đặc biệt (ví dụ: vật thể không lún xuống đất)
            if (mesh.userData.groundY !== undefined) {
                 // Đảm bảo chân vật thể không lún quá mặt đất (Y=0)
                 if (mesh.userData.cannonShapeType === 'Box' || mesh.userData.cannonShapeType === 'Cylinder') {
                     // Lấy half height từ userData (nếu có) hoặc từ kích thước shape của Cannon.js
                     let halfHeight = 0;
                     if (mesh.userData.cannonShapeType === 'Box') {
                         halfHeight = mesh.userData.cannonHalfExtents.y;
                     } else if (mesh.userData.cannonShapeType === 'Cylinder') {
                         halfHeight = mesh.userData.cannonHeight / 2;
                     }

                     // Nếu vị trí của tâm body nhỏ hơn (halfHeight - groundY) thì điều chỉnh
                     if (mesh.position.y < mesh.userData.groundY + halfHeight) {
                         mesh.position.y = mesh.userData.groundY + halfHeight;
                         body.position.y = mesh.userData.groundY + halfHeight;
                         body.velocity.y = 0; // Đảm bảo vận tốc Y bằng 0 để vật thể không lún
                     }
                 }
            }
        }
    }

    /**
     * Đăng ký một listener cho sự kiện va chạm giữa hai body.
     * @param {CANNON.Body} body1 Thân vật lý thứ nhất.
     * @param {CANNON.Body} body2 Thân vật lý thứ hai.
     * @param {function(CANNON.Event)} callback Hàm callback khi va chạm xảy ra.
     */
    addCollisionListener(body1, body2, callback) {
        // Cannon.js có một số cách để lắng nghe va chạm.
        // Cách đơn giản nhất là lắng nghe sự kiện 'collide' trên một trong các body.
        // Tuy nhiên, để quản lý tập trung, chúng ta có thể làm như sau:
        // Lưu trữ cặp body và callback, sau đó kiểm tra trong update.
        // Hoặc sử dụng Cannon.js collision groups/masks nếu phức tạp hơn.

        // Cách tiếp cận trực tiếp của Cannon.js:
        body1.addEventListener('collide', (event) => {
            if (event.body === body2) {
                callback(event);
            }
        });
        body2.addEventListener('collide', (event) => {
            if (event.body === body1) {
                callback(event);
            }
        });
        console.log(`Registered collision listener between body ${body1.id} and ${body2.id}`);
    }

    // Bạn có thể thêm các hàm hỗ trợ debug visualization nếu muốn
    // (ví dụ: tạo lưới cho từng Cannon.Body để hiển thị hình dạng vật lý)
    // drawPhysicsDebug() { ... }
}