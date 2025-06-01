import * as THREE from 'three';

export class CollisionManager {
    constructor(car, otherObjects) {
        this.car = car;
        // Kết hợp xe và các vật thể khác thành một mảng duy nhất để xử lý vật lý chung
        this.allDynamicObjects = [car, ...otherObjects];
        // Bạn có thể có một mảng riêng cho các đối tượng tĩnh nếu cần, nhưng hiện tại ta giả định plane là tĩnh và được xử lý riêng trong updatePhysics
    }

    /**
     * Cập nhật tất cả các va chạm và vật lý trong scene.
     * Nên gọi trong vòng lặp game (animation loop).
     */
    updateCollisions() {
        // Bước 1: Cập nhật vật lý (áp dụng trọng lực, vận tốc) cho TẤT CẢ các vật thể động
        // Mỗi vật thể sẽ được cập nhật vị trí dựa trên vận tốc và trọng lực
        for (let i = 0; i < this.allDynamicObjects.length; i++) {
            updatePhysics(this.allDynamicObjects[i]);
        }

        // Bước 2: Kiểm tra và giải quyết va chạm giữa các vật thể động với nhau
        // Đây là nơi các vật thể va chạm và đẩy nhau ra
        for (let i = 0; i < this.allDynamicObjects.length; i++) {
            for (let j = i + 1; j < this.allDynamicObjects.length; j++) {
                const objA = this.allDynamicObjects[i];
                const objB = this.allDynamicObjects[j];

                // Đảm bảo cả hai đối tượng đều là động và có dữ liệu userData
                if (objA.userData && objA.userData.isDynamic && objB.userData && objB.userData.isDynamic) {
                    checkCollisionAndApplyForce(objA, objB);
                }
            }
        }
        // Lưu ý: Va chạm với mặt đất đã được xử lý trong updatePhysics của từng vật thể
    }
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

    // Kiểm tra nếu vận tốc hoặc khối lượng không hợp lệ, không thực hiện va chạm
    if (!velocityA || !velocityB || massA === undefined || massB === undefined) {
        // console.warn("Missing velocity or mass in userData for collision check:", objA.name, objB.name);
        return false;
    }


    objA.traverse((childA) => {
        if (!childA.isMesh || !childA.boundingBox) return;

        const boxA = childA.boundingBox.clone().applyMatrix4(childA.matrixWorld);

        objB.traverse((childB) => {
            if (!childB.isMesh || !childB.boundingBox) return;

            const boxB = childB.boundingBox.clone().applyMatrix4(childB.matrixWorld);

            if (boxA.intersectsBox(boxB)) {
                collided = true;

                const collisionNormal = new THREE.Vector3().subVectors(objB.position, objA.position);
                if (collisionNormal.lengthSq() === 0) {
                    collisionNormal.set(0, 1, 0); // Default to +Y if positions are identical
                }
                collisionNormal.normalize();

                // Dòng lỗi trước đây nằm ở đây: sử dụng velocityA và velocityB từ userData
                const relativeVelocity = new THREE.Vector3().subVectors(velocityB, velocityA);

                const velocityAlongNormal = relativeVelocity.dot(collisionNormal);

                if (velocityAlongNormal < 0) {
                    const restitution = 0
                    const forceImpactMultiplier = 1.7;

                    const totalInverseMass = objA.userData.inverseMass + objB.userData.inverseMass;
                    if (totalInverseMass === 0) {
                        console.warn("Total inverse mass is zero, collision impulse won't be applied.");
                        return;
                    }

                    const impulseMagnitude = -(1 + restitution) * velocityAlongNormal * forceImpactMultiplier;
                    const impulse = impulseMagnitude / totalInverseMass;

                    // Áp dụng impulse vào vận tốc trong userData
                    velocityA.addScaledVector(collisionNormal, -impulse * objA.userData.inverseMass);
                    velocityB.addScaledVector(collisionNormal, impulse * objB.userData.inverseMass);

                    // console.log('Collision Impulse Applied! Velocity A:', velocityA, 'Velocity B:', velocityB);
                }

                const separationAmount = 0.05;

                const totalMass = massA + massB;
                if (totalMass > 0) {
                    const separationVector = collisionNormal.clone().multiplyScalar(separationAmount);
                    // Move objA back along the normal, proportional to objB's mass
                    objA.position.sub(separationVector.clone().multiplyScalar(massB / totalMass));
                    // Move objB forward along the normal, proportional to objA's mass
                    objB.position.add(separationVector.clone().multiplyScalar(massA / totalMass));
                }
            }
        });
    });
    return collided;
}

/**
 * Updates the position of an object based on its velocity.
 * Applies damping to gradually reduce velocity.
 * Includes simple gravity and ground collision.
 * @param {THREE.Object3D} object The object to update physics for.
 * @param {number} deltaTime The time elapsed since the last frame (default 1/60 for 60 FPS).
 */
const GRAVITY = new THREE.Vector3(0, -9.8, 0); // Gia tốc trọng trường (m/s^2)
const fixedDeltaTime = 1 / 60; // Giả sử physics update 60 lần/giây

export function updatePhysics(object) {
    const userData = object.userData;

    // Chỉ áp dụng vật lý cho các vật thể được đánh dấu là động và có khối lượng > 0
    if (!userData || !userData.isDynamic || userData.mass <= 0) return;

    // 1. Áp dụng trọng lực
    const gravitationalForce = GRAVITY.clone().multiplyScalar(userData.mass);
    userData.forces.add(gravitationalForce);

    // 2. Áp dụng sức cản không khí (phụ thuộc vào khối lượng)
    // Để vật thể nặng rơi nhanh hơn, chúng ta làm cho sức cản không khí ít ảnh hưởng đến chúng hơn.
    // Một cách đơn giản là làm cho hệ số cản tỷ lệ nghịch với khối lượng.
    // Giá trị baseDrag càng lớn, sức cản càng mạnh và sự khác biệt giữa các vật thể càng rõ.
    const baseDrag = 1; // Hệ số cản cơ bản, có thể điều chỉnh
    const effectiveDragCoefficient = baseDrag / userData.mass; // Vật nặng hơn (mass lớn hơn) sẽ có effectiveDragCoefficient nhỏ hơn

    if (userData.velocity.lengthSq() > 0.0001) { // Chỉ áp dụng nếu có vận tốc đáng kể
        const airResistanceForce = userData.velocity.clone().normalize().multiplyScalar(-effectiveDragCoefficient * userData.velocity.length());
        userData.forces.add(airResistanceForce);
    }

    // 2. Tính toán gia tốc (a = F / m)
    const acceleration = userData.forces.clone().multiplyScalar(userData.inverseMass);

    // 3. Cập nhật vận tốc (v = v0 + a * dt)
    userData.velocity.add(acceleration.multiplyScalar(fixedDeltaTime));

    // 4. Áp dụng lực cản (ma sát không khí/lực cản chung)
    userData.velocity.multiplyScalar(0.995);

    // 5. Cập nhật vị trí (p = p0 + v * dt)
    object.position.add(userData.velocity.clone().multiplyScalar(fixedDeltaTime));

    // 6. Reset lực tác dụng cho frame tiếp theo
    userData.forces.set(0, 0, 0);

    // Xử lý va chạm với mặt đất (để vật thể không rơi xuyên qua)
    // Đảm bảo halfExtents được tính toán và lưu chính xác trong userData của object chính
    if (userData.halfExtents) {
        const bottomY = object.position.y - userData.halfExtents.y;
        const groundLevel = 0; // Giả sử mặt đất ở y = 0
        const minVelocityThreshold = 0.05;

        if (bottomY < groundLevel) {
            object.position.y = groundLevel ; // Đặt vật thể lên mặt đất
            
            // Dừng rơi hoặc nảy nhẹ
            if (userData.velocity.y < 0) { // Chỉ xử lý khi đang rơi xuống
                if (Math.abs(userData.velocity.y) < minVelocityThreshold) {
                    userData.velocity.y = 0; // Dừng hẳn nếu vận tốc quá nhỏ
                } else {
                    userData.velocity.y *= -0.5; // Bật nảy với 30% vận tốc ngược lại
                }
            }
        }
    }
}