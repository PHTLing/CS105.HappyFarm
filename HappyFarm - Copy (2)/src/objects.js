import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { addBoundingBox, setMass, drawBoundingBox} from './feature.js';

/**
 * Loads the car model and sets its initial properties.
 * @returns {Promise<{carGroup: THREE.Object3D, frontWheel_L: THREE.Object3D, frontWheel_R: THREE.Object3D, wheel_L: THREE.Object3D, wheel_R: THREE.Object3D, backWheels: THREE.Object3D}>} 
 */
export function createCar() {
    const loader = new GLTFLoader();
    const carModelUrl = 'assets/models/Truck.glb';

    return new Promise((resolve, reject) => {
        loader.load(
            carModelUrl,
            (gltf) => {
                const carGroup = gltf.scene;
                carGroup.visible = true;
                carGroup.rotateY(Math.PI);
                carGroup.scale.set(1, 1, 1);

                carGroup.name = 'CarBody_Main';

                const bbox = new THREE.Box3().setFromObject(carGroup);
                // ✅ SỬA LỖI: Đặt vị trí Y của xe để nó nằm trên mặt đất
                // Có thể cần điều chỉnh offset này tùy thuộc vào mô hình của bạn
                carGroup.position.y = -bbox.min.y + 0.1; // + 0.1 để đảm bảo không bị lún

                carGroup.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });

                const frontWheel_L = carGroup.getObjectByName('FrontWheel_L');
                const frontWheel_R = carGroup.getObjectByName('FrontWheel_R');
                const backWheels = carGroup.getObjectByName('BackWheels');
                const wheel_L = frontWheel_L ? frontWheel_L.getObjectByName('Wheel_L') : null;
                const wheel_R = frontWheel_R ? frontWheel_R.getObjectByName('Wheel_R') : null;

                if (!frontWheel_L || !frontWheel_R || !wheel_L || !wheel_R || !backWheels) {
                    console.warn("Could not find steering pivot objects or wheel meshes. Steering/Rolling might not work as expected.");
                    console.warn("Expected names: 'FrontWheel_L', 'FrontWheel_R', 'Wheel_L', 'Wheel_R', 'BackWheels'");
                    resolve({
                        carGroup: carGroup,
                        frontWheel_L: null, frontWheel_R: null,
                        wheel_L: null, wheel_R: null,
                        backWheels: null
                    });
                    return;
                }

                carGroup.userData.cannonShapeType = 'Box'; // Giả định hình dạng vật lý là Box cho car
                setMass(carGroup, 500); // Tăng khối lượng xe lên đáng kể (tùy chỉnh)
                addBoundingBox(carGroup);
                drawBoundingBox(carGroup); // ✅ Bỏ comment để thấy bounding box của xe

                resolve({
                    carGroup, frontWheel_L, frontWheel_R, wheel_L, wheel_R, backWheels
                });
            },
            undefined,
            (error) => {
                console.error('Error loading car model:', error);
                reject(error);
            }
        );
    });
}

/**
 * Loads the farm model and sets its initial properties.
 * @returns {Promise<THREE.Object3D>} The loaded farm model.
 */
export function createFarm() {
    const loader = new GLTFLoader();
    const farmModelUrl = 'assets/models/FarmTL.glb'; 

    return new Promise((resolve, reject) => {
        loader.load(
            farmModelUrl,
            (gltf) => {
                const Farm = gltf.scene; 
                // Cần điều chỉnh scale và rotation nếu cần cho mô hình của bạn
                Farm.scale.set(1, 1, 1);
                Farm.rotateY(Math.PI);
                
                // === THÊM TÊN CHO FARM ===
                Farm.name = 'Farm_Main'; 

                // Có thể thêm castShadow và receiveShadow cho các mesh trong Farm
                Farm.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true; 
                        node.receiveShadow = true;
                    }
                });
                
                Farm.position.y = -0.05; 

                // === THÊM userData.cannonShapeType ===
                // Vì FarmTL.glb có thể là một mô hình phức tạp, việc sử dụng 'Trimesh' cần được xử lý cẩn thận trong CollisionManager
                // Hoặc bạn có thể dùng 'Plane' nếu nó chỉ là mặt đất phẳng, hoặc 'Box' nếu nó là một khối đơn giản.
                // Tạm thời để là 'Trimesh' và bạn phải tự xử lý nó trong CollisionManager nếu muốn va chạm chính xác.
                // Để đơn giản, nếu Farm chỉ là một phần cảnh tĩnh và xe không cần va chạm chi tiết với từng phần của nó,
                // bạn có thể đặt mass = 0 và không cần xử lý va chạm phức tạp với nó trong CollisionManager.
                Farm.userData.cannonShapeType = 'Trimesh'; 
                setMass(Farm, 0); // Mass = 0 -> tĩnh
                addBoundingBox(Farm);
                // drawBoundingBox(Farm, 0x00ff00); // Bỏ comment để xem BBox của Farm
                
                resolve(Farm); 
            },
            undefined, 
            (error) => {
                console.error('Error loading farm model:', error);
                reject(error); 
            }
        );
    });
}

export function createGround(width, height, color) {
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({ color: color })
    );
    ground.rotation.x = -0.5 * Math.PI; // Rotate to be horizontal
    ground.receiveShadow = true; // Ground receives shadows

    // === THÊM userData.cannonShapeType ===
    ground.userData.cannonShapeType = 'Plane';
    ground.name = 'Ground';
    setMass(ground, 0); // Mass = 0 -> tĩnh
    addBoundingBox(ground); // Đảm bảo ground cũng có BBox
    // drawBoundingBox(ground, 0x00ff00); // Bỏ comment để xem BBox của Ground
    return ground;
}


export class ObjectManager {
    constructor(scene, worldGroup) {
        this.scene = scene;
        this.worldGroup = worldGroup;
        this.interactiveObjects = [];
    }

    createBox(x, y, z, size, mass, color) {
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({ color: color });
        geometry.translate(0, size / 2, 0); 
        const box = new THREE.Mesh(geometry, material);

        box.position.set(x, y, z);
        box.castShadow = true;
        box.receiveShadow = true;
        box.name = `Box_${this.interactiveObjects.length}`;

        if (!box.userData) box.userData = {};
        box.userData.cannonShapeType = 'Box'; // Loại hình dạng vật lý

        this.worldGroup.add(box);

        setMass(box, mass);
        addBoundingBox(box);
        // drawBoundingBox(box, color);

        this.interactiveObjects.push(box);
        return box;
    }

    createBox1(x, y, z, size, mass, color) {
        const height = 10 * size; 
        const geometry = new THREE.BoxGeometry(size, height, size);
        
        const material = new THREE.MeshBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.5,
            side: THREE.DoubleSide 
        });
        const box = new THREE.Mesh(geometry, material);

        // --- THAY ĐỔI QUAN TRỌNG NHẤT Ở ĐÂY ---
        // Dịch chuyển gốc của geometry xuống đáy của nó.
        // Điều này làm cho điểm (0,0,0) của mesh nằm ở chân của hình hộp.
        geometry.translate(0, height / 2, 0); 
        
        // Đặt vị trí của mesh trong không gian thế giới.
        // Vì gốc của geometry đã là chân cây, nếu muốn chân cây nằm ở Y=0,
        // thì position.y của mesh phải là 0 + (half_height) của mesh
        // NO, it should be just Y. If Y=0 is ground, the "foot" of the object is at Y.
        // Example: if y=0 (ground), then box.position.y should be 0.
        // This makes the translated origin (the foot) sit at world Y=0.
        box.position.set(x, y, z); 
        
        box.castShadow = true;
        box.receiveShadow = true;
        box.name = `TallBox_${this.interactiveObjects.length}`;

        if (!box.userData) box.userData = {};
        box.userData.cannonShapeType = 'Box'; // Loại hình dạng vật lý

        this.worldGroup.add(box);

        setMass(box, mass);
        addBoundingBox(box);
        // drawBoundingBox(box, color);

        box.userData.groundY = y; 
        box.userData.initialHeight = height; 
        box.userData.originalPosition = new THREE.Vector3(x, y, z); // Lưu lại vị trí ban đầu của chân cây

        // --- BỔ SUNG: VẼ ĐIỂM PIVOT ---
        const pivotGeometry = new THREE.SphereGeometry(0.2, 8, 8); 
        const pivotMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); 
        const pivotPoint = new THREE.Mesh(pivotGeometry, pivotMaterial);
        
        // Đặt pivotPoint ở đúng vị trí chân cây trong thế giới.
        // Vì box.position.y bây giờ chính là vị trí Y của chân cây,
        // chúng ta chỉ cần đặt pivotPoint.position.y = box.position.y.
        pivotPoint.position.set(box.position.x, box.position.y, box.position.z); 
        this.worldGroup.add(pivotPoint);

        this.interactiveObjects.push(box);
        return box;
    }
    
    // createCylinder giữ nguyên (đã đúng)
    createCylinder(x, y, z, radius, height, radialSegments, mass, color) {
        const geometry = new THREE.CylinderGeometry(radius, radius, height, radialSegments);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const cylinder = new THREE.Mesh(geometry, material);

        geometry.translate(0, height / 2, 0); // Dịch chuyển gốc geometry xuống đáy
        cylinder.position.set(x, y, z); // Đặt vị trí của chân trụ tại Y

        cylinder.castShadow = true;
        cylinder.receiveShadow = true;
        cylinder.name = `Cylinder_${this.interactiveObjects.length}`;

        if (!cylinder.userData) cylinder.userData = {};
        cylinder.userData.cannonShapeType = 'Cylinder'; // Loại hình dạng vật lý

        this.worldGroup.add(cylinder);

        setMass(cylinder, mass);
        addBoundingBox(cylinder);
        // drawBoundingBox(cylinder, color);

        cylinder.userData.groundY = y;
        cylinder.userData.initialHeight = height;

        this.interactiveObjects.push(cylinder);
        return cylinder;
    }

    getInteractiveObjects() {
        return this.interactiveObjects;
    }
}