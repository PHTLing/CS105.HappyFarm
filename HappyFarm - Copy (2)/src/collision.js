import * as THREE from 'three';

const GRAVITY = new THREE.Vector3(0, -9.8, 0); // Gia tốc trọng trường (m/s^2)

export class CollisionManager {
    // THÊM staticObjects vào constructor
    constructor(car, dynamicObjects, staticObjects) {
        this.car = car;
        this.dynamicObjects = [car, ...dynamicObjects]; // Tất cả vật thể động (bao gồm xe)
        this.staticObjects = staticObjects; // Các vật thể tĩnh (Ground, Farm)
    }

    /**
     * Cập nhật tất cả các va chạm và vật lý trong scene.
     * Nên gọi trong vòng lặp game (animation loop).
     * @param {number} deltaTime Thời gian trôi qua từ khung hình trước (giây).
     */
    updateCollisions(deltaTime) {
        // Bước 1: Cập nhật vật lý (áp dụng trọng lực, vận tốc, lực từ controller) cho TẤT CẢ các vật thể động
        for (let i = 0; i < this.dynamicObjects.length; i++) {
            updatePhysics(this.dynamicObjects[i], deltaTime);
        }

        // Bước 2: Kiểm tra và giải quyết va chạm giữa các vật thể động với nhau
        for (let i = 0; i < this.dynamicObjects.length; i++) {
            for (let j = i + 1; j < this.dynamicObjects.length; j++) {
                const objA = this.dynamicObjects[i];
                const objB = this.dynamicObjects[j];

                if (objA.userData.isDynamic && objB.userData.isDynamic) {
                    checkCollisionAndApplyForce(objA, objB);
                }
            }
        }

        // Bước 3: Kiểm tra và giải quyết va chạm giữa vật thể động và vật thể tĩnh
        for (let i = 0; i < this.dynamicObjects.length; i++) {
            const dynamicObj = this.dynamicObjects[i];
            if (!dynamicObj.userData.isDynamic) continue;

            for (let j = 0; j < this.staticObjects.length; j++) {
                const staticObj = this.staticObjects[j];
                // Vật thể tĩnh phải có mass = 0 hoặc isDynamic = false
                if (staticObj.userData.mass === 0 || !staticObj.userData.isDynamic) {
                    checkCollisionAndApplyForce(dynamicObj, staticObj); // Hàm này đã được thiết kế để xử lý va chạm với vật tĩnh (mass = 0)
                }
            }
        }
    }
}


/**
 * Áp dụng lực động cơ và mô-men xoắn lái từ CarController vào xe.
 * @param {THREE.Object3D} car Đối tượng xe.
 * @param {number} engineForce Lực động cơ.
 * @param {number} steeringTorque Mô-men xoắn lái.
 * @param {number} deltaTime Thời gian trôi qua.
 */
export function applyForcesToCar(car, engineForce, steeringTorque, deltaTime) {
    const userData = car.userData;
    if (!userData || !userData.isDynamic || userData.mass <= 0) return;

    // Lực động cơ: áp dụng theo hướng tiến của xe
    const forwardVector = new THREE.Vector3(0, 0, 1);
    forwardVector.applyQuaternion(car.quaternion); // Chuyển sang hướng thế giới của xe
    userData.forces.add(forwardVector.multiplyScalar(engineForce));

    // Mô-men xoắn: áp dụng quanh trục Y (quay)
    // Tốc độ góc được thêm trực tiếp vào userData.angularVelocity.y
    userData.angularVelocity.y += steeringTorque * userData.inverseMass * deltaTime * 100; // Tăng hệ số này để xe quay mạnh hơn
    // Giảm dần mô-men xoắn để không tích lũy vô hạn
    userData.torque.set(0, 0, 0); // Reset mô-men xoắn sau khi áp dụng
}


/**
 * Checks for collision between two objects and applies force.
 * This function handles simple AABB (Axis-Aligned Bounding Box) collision
 * and resolves overlap to prevent sticking.
 * @param {THREE.Object3D} objA The first object.
 * @param {THREE.Object3D} objB The second object.
 * @returns {boolean} True if a collision occurred, false otherwise.
 */
export function checkCollisionAndApplyForce(objA, objB) {
    let collided = false;

    // Lấy vận tốc và khối lượng từ userData
    const velocityA = objA.userData.velocity;
    const velocityB = objB.userData.velocity;
    const massA = objA.userData.mass;
    const massB = objB.userData.mass;
    const inverseMassA = objA.userData.inverseMass;
    const inverseMassB = objB.userData.inverseMass;

    // Kiểm tra nếu vận tốc hoặc khối lượng không hợp lệ, không thực hiện va chạm
    if (!velocityA || !velocityB || massA === undefined || massB === undefined) {
        // console.warn("Missing velocity or mass in userData for collision check:", objA.name, objB.name);
        return false;
    }

    // Lấy BBox tổng thể cho mỗi object, vì đây là va chạm giữa các object cha
    const boxA = new THREE.Box3().setFromObject(objA);
    const boxB = new THREE.Box3().setFromObject(objB);

    if (boxA.intersectsBox(boxB)) {
        collided = true;

        // Tính toán vector đẩy ra (separation vector)
        const overlap = new THREE.Vector3();
        boxA.intersect(boxB).getSize(overlap); // Kích thước của phần giao nhau
        
        const centerA = boxA.getCenter(new THREE.Vector3());
        const centerB = boxB.getCenter(new THREE.Vector3());
        const direction = new THREE.Vector3().subVectors(centerB, centerA);

        let pushVector = new THREE.Vector3();
        if (Math.abs(direction.x) > Math.abs(direction.y) && Math.abs(direction.x) > Math.abs(direction.z)) {
            pushVector.x = (direction.x > 0 ? overlap.x : -overlap.x);
        } else if (Math.abs(direction.y) > Math.abs(direction.z)) {
            pushVector.y = (direction.y > 0 ? overlap.y : -overlap.y);
        } else {
            pushVector.z = (direction.z > 0 ? overlap.z : -overlap.z);
        }

        // Đảm bảo không đẩy ra quá xa, chỉ đủ để không còn chồng lấn
        pushVector.x = Math.min(Math.abs(pushVector.x), Math.abs(boxA.max.x - boxB.min.x), Math.abs(boxB.max.x - boxA.min.x)) * Math.sign(pushVector.x);
        pushVector.y = Math.min(Math.abs(pushVector.y), Math.abs(boxA.max.y - boxB.min.y), Math.abs(boxB.max.y - boxA.min.y)) * Math.sign(pushVector.y);
        pushVector.z = Math.min(Math.abs(pushVector.z), Math.abs(boxA.max.z - boxB.min.z), Math.abs(boxB.max.z - boxA.min.z)) * Math.sign(pushVector.z);

        // Chia đều phần đẩy ra theo khối lượng
        const totalInverseMass = inverseMassA + inverseMassB;
        if (totalInverseMass > 0) {
            const ratioA = inverseMassA / totalInverseMass;
            const ratioB = inverseMassB / totalInverseMass;

            objA.position.sub(pushVector.clone().multiplyScalar(ratioA));
            objB.position.add(pushVector.clone().multiplyScalar(ratioB));
        }

        // Tính toán normal va chạm sau khi đã đẩy ra (để đảm bảo hướng chính xác)
        const collisionNormal = new THREE.Vector3().subVectors(objB.position, objA.position).normalize();
        if (collisionNormal.lengthSq() === 0) {
             collisionNormal.set(0, 1, 0); // Default to +Y if positions are identical
        }
        
        const relativeVelocity = new THREE.Vector3().subVectors(velocityB, velocityA);
        const velocityAlongNormal = relativeVelocity.dot(collisionNormal);

        if (velocityAlongNormal < 0) { // Chỉ xử lý va chạm khi các vật thể đang tiến lại gần nhau
            const restitution = 0.3; // Độ nảy, TÙY CHỈNH GIÁ TRỊ NÀY (0: không nảy, 1: nảy hoàn toàn)
            
            // Impulse dựa trên vận tốc dọc theo normal
            const impulseMagnitude = -(1 + restitution) * velocityAlongNormal;
            const impulse = impulseMagnitude / totalInverseMass;

            // Áp dụng impulse vào vận tốc
            velocityA.addScaledVector(collisionNormal, -impulse * inverseMassA);
            velocityB.addScaledVector(collisionNormal, impulse * inverseMassB);

            // console.log('Collision Impulse Applied! Velocity A:', velocityA, 'Velocity B:', velocityB);
        }
    }
    return collided;
}

/**
 * Updates the position and rotation of an object based on its velocity and applied forces.
 * Applies damping, gravity, and ground collision.
 * @param {THREE.Object3D} object The object to update physics for.
 * @param {number} deltaTime The time elapsed since the last frame.
 */
export function updatePhysics(object, deltaTime) {
    const userData = object.userData;

    if (!userData || !userData.isDynamic || userData.mass <= 0) return;

    // 1. Áp dụng trọng lực
    const gravitationalForce = GRAVITY.clone().multiplyScalar(userData.mass);
    userData.forces.add(gravitationalForce);

    // 2. Áp dụng sức cản không khí
    // ✅ SỬA LỖI: Tăng airResistanceCoefficient một chút để xe dừng nhanh hơn trong không khí
    const airResistanceCoefficient = 2; // TĂNG GIÁ TRỊ NÀY ĐỂ LÀM CHẬM XE TRONG KHÔNG KHÍ
    if (userData.velocity.lengthSq() > 0.0001) {
        const airResistanceForce = userData.velocity.clone().normalize().multiplyScalar(-airResistanceCoefficient * userData.velocity.length()); // Dùng length thay vì lengthSq cho mô phỏng ma sát tuyến tính
        userData.forces.add(airResistanceForce);
    }

    // 3. Tính toán gia tốc (a = F / m)
    const acceleration = userData.forces.clone().multiplyScalar(userData.inverseMass);

    // 4. Cập nhật vận tốc tuyến tính (v = v0 + a * dt)
    userData.velocity.add(acceleration.multiplyScalar(deltaTime));

    // 5. Cập nhật vị trí (p = p0 + v * dt)
    object.position.add(userData.velocity.clone().multiplyScalar(deltaTime));

    // 6. Cập nhật vận tốc góc (quay)
    // userData.angularVelocity đã được cập nhật từ applyForcesToCar
    object.rotation.y += userData.angularVelocity.y * deltaTime;

    // ✅ Thêm damping cho vận tốc góc để xe không quay mãi
    const angularDamping = 0.95; // Giảm nhẹ vận tốc góc mỗi frame (0.9 - 0.99)
    userData.angularVelocity.y *= angularDamping;


    // 7. Reset lực và mô-men xoắn cho frame tiếp theo
    userData.forces.set(0, 0, 0);
    userData.torque.set(0, 0, 0);

    // Xử lý va chạm với mặt đất (cơ bản)
    if (userData.halfExtents) {
        const bottomY = object.position.y - userData.halfExtents.y;
        const groundLevel = 0;
        const minVelocityThreshold = 0.05; // Ngưỡng vận tốc để dừng hẳn

        if (bottomY < groundLevel) {
            object.position.y = groundLevel + userData.halfExtents.y;

            if (userData.velocity.y < 0) { // Nếu đang rơi xuống
                if (Math.abs(userData.velocity.y) < minVelocityThreshold) {
                    userData.velocity.y = 0; // Dừng hẳn nếu vận tốc quá nhỏ
                } else {
                    userData.velocity.y *= -0.3; // Nảy lên một chút
                }
            }
            // Áp dụng ma sát ngang khi chạm đất
            // ✅ GIẢM GIÁ TRỊ NÀY ĐỂ TĂNG MA SÁT VÀ DỪNG XE NHANH HƠN
            const frictionCoefficient = 0.9; // Giá trị càng nhỏ, ma sát càng lớn
            userData.velocity.x *= frictionCoefficient;
            userData.velocity.z *= frictionCoefficient;
            userData.angularVelocity.y *= frictionCoefficient; // Giảm vận tốc góc khi chạm đất
        }
    }
}