import * as THREE from 'three';

export class CollisionManager {
    constructor(car, otherObjects) {
        this.car = car;
        this.allDynamicObjects = [car, ...otherObjects];
    }

    updateCollisions() {
        // Bước 1: Cập nhật vật lý (áp dụng trọng lực, vận tốc) cho TẤT CẢ các vật thể động
        for (let i = 0; i < this.allDynamicObjects.length; i++) {
            updatePhysics(this.allDynamicObjects[i]);
        }

        // Bước 2: Kiểm tra và giải quyết va chạm giữa các vật thể động với nhau
        // Lặp lại nhiều lần để giải quyết chồng lấn tốt hơn (Iterative solving)
        // Điều này giúp giảm jittering và tunneling ở mức độ nào đó, nhưng tốn hiệu năng.
        // Bạn có thể điều chỉnh số lần lặp (ví dụ: 1 đến 5 lần)
        const numCollisionIterations = 3; 
        for (let iter = 0; iter < numCollisionIterations; iter++) {
            for (let i = 0; i < this.allDynamicObjects.length; i++) {
                for (let j = i + 1; j < this.allDynamicObjects.length; j++) {
                    const objA = this.allDynamicObjects[i];
                    const objB = this.allDynamicObjects[j];

                    if (objA.userData && objA.userData.isDynamic && objB.userData && objB.userData.isDynamic) {
                        checkCollisionAndApplyForce(objA, objB);
                    }
                }
            }
        }
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

    const velocityA = objA.userData.velocity;
    const velocityB = objB.userData.velocity;
    const massA = objA.userData.mass;
    const massB = objB.userData.mass;

    if (!velocityA || !velocityB || massA === undefined || massB === undefined) {
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

                // 1. Calculate collision normal and penetration depth
                const intersectionBox = new THREE.Box3().intersect(boxA, boxB);
                const size = new THREE.Vector3();
                intersectionBox.getSize(size);

                // Determine the axis of least penetration
                let penetrationDepth = 0;
                let collisionNormal = new THREE.Vector3();

                const centerA = boxA.getCenter(new THREE.Vector3());
                const centerB = boxB.getCenter(new THREE.Vector3());
                const diff = new THREE.Vector3().subVectors(centerB, centerA);

                // Project difference onto axes and find smallest overlap
                const dx = boxA.max.x - boxB.min.x; // overlap in x
                const dy = boxA.max.y - boxB.min.y; // overlap in y
                const dz = boxA.max.z - boxB.min.z; // overlap in z

                // Find smallest overlap and set normal.
                // Using absolute values of differences for axis-aligned boxes.
                // The actual overlap is size.x, size.y, size.z
                const overlapX = size.x;
                const overlapY = size.y;
                const overlapZ = size.z;

                if (overlapX < overlapY && overlapX < overlapZ) {
                    penetrationDepth = overlapX;
                    collisionNormal.set(Math.sign(diff.x), 0, 0); // Normal points from A to B
                } else if (overlapY < overlapX && overlapY < overlapZ) {
                    penetrationDepth = overlapY;
                    collisionNormal.set(0, Math.sign(diff.y), 0);
                } else {
                    penetrationDepth = overlapZ;
                    collisionNormal.set(0, 0, Math.sign(diff.z));
                }

                // If objects are exactly on top of each other, diff might be 0 for XZ, so Y normal is preferred.
                // This is a common heuristic for stable stacking.
                if (Math.abs(collisionNormal.y) > 0.001) { // Prefer Y normal if there's significant Y overlap
                    collisionNormal.set(0, Math.sign(diff.y), 0);
                    penetrationDepth = overlapY;
                }
                
                // If collisionNormal is somehow zero (e.g. perfect overlap), pick a default.
                if (collisionNormal.lengthSq() === 0) {
                    collisionNormal.set(0, 1, 0); // Fallback to +Y
                }


                // 2. Resolve overlap (push objects apart)
                // Phân bổ việc đẩy ra dựa trên khối lượng nghịch đảo (inverseMass)
                const totalInverseMass = objA.userData.inverseMass + objB.userData.inverseMass;
                if (totalInverseMass === 0) { // Cả hai đều là tĩnh hoặc khối lượng 0
                    return;
                }

                const penetrationCorrection = collisionNormal.clone().multiplyScalar(penetrationDepth / totalInverseMass);
                
                // Điều chỉnh vị trí để giải quyết chồng lấn
                // Dùng một epsilon nhỏ để tránh jittering
                const slop = 0.01; // "Slop" value to allow slight penetration, reducing jittering
                const separation = Math.max(0, penetrationDepth - slop); 
                const positionCorrection = collisionNormal.clone().multiplyScalar(separation / totalInverseMass);


                // Chỉ điều chỉnh vị trí nếu vật thể là động
                if (objA.userData.isDynamic) {
                    objA.position.sub(positionCorrection.clone().multiplyScalar(objA.userData.inverseMass));
                }
                if (objB.userData.isDynamic) {
                    objB.position.add(positionCorrection.clone().multiplyScalar(objB.userData.inverseMass));
                }

                // 3. Calculate impulse (change in momentum)
                const relativeVelocity = new THREE.Vector3().subVectors(velocityB, velocityA);
                const velocityAlongNormal = relativeVelocity.dot(collisionNormal);

                // Only apply impulse if objects are moving towards each other or are already overlapping slightly
                if (velocityAlongNormal < 0 || penetrationDepth > 0) {
                    const restitution = 0.0; // Đặt về 0 để không có độ nảy
                    
                    // Tính impulse theo công thức tiêu chuẩn
                    const impulseMagnitude = -(1 + restitution) * velocityAlongNormal;
                    const impulse = impulseMagnitude / totalInverseMass;

                    // Áp dụng impulse vào vận tốc (luôn áp dụng)
                    if (objA.userData.isDynamic) {
                        velocityA.addScaledVector(collisionNormal, -impulse * objA.userData.inverseMass);
                    }
                    if (objB.userData.isDynamic) {
                        velocityB.addScaledVector(collisionNormal, impulse * objB.userData.inverseMass);
                    }

                    // *** BỔ SUNG: Xử lý Ma sát (Friction) ***
                    // Tính vận tốc tiếp tuyến (tangent velocity)
                    const tangentVelocity = new THREE.Vector3().subVectors(relativeVelocity, collisionNormal.clone().multiplyScalar(velocityAlongNormal));
                    if (tangentVelocity.lengthSq() > 0.0001) { // Chỉ xử lý nếu có vận tốc tiếp tuyến đáng kể
                        tangentVelocity.normalize();
                        
                        const frictionCoefficient = 0.7; // Hệ số ma sát động, điều chỉnh ở đây (0.0 đến 1.0)
                        const frictionImpulseMagnitude = -relativeVelocity.dot(tangentVelocity) * frictionCoefficient; // Lực ma sát tỷ lệ với lực va chạm bình thường
                        const frictionImpulse = frictionImpulseMagnitude / totalInverseMass;

                        // Clamp friction impulse to avoid overshooting
                        const maxFrictionImpulse = impulse * frictionCoefficient; // Ma sát không thể lớn hơn lực va chạm
                        const clampedFrictionImpulse = Math.min(Math.abs(frictionImpulse), maxFrictionImpulse) * Math.sign(frictionImpulse);

                        if (objA.userData.isDynamic) {
                            velocityA.addScaledVector(tangentVelocity, clampedFrictionImpulse * objA.userData.inverseMass);
                        }
                        if (objB.userData.isDynamic) {
                            velocityB.addScaledVector(tangentVelocity, -clampedFrictionImpulse * objB.userData.inverseMass);
                        }
                    }

                    // *** XỬ LÝ PHẢN ỨNG VA CHẠM DỰA TRÊN KHỐI LƯỢNG (YÊU CẦU CỦA BẠN) ***
                    // Logic hiện tại đã phân bổ lực dựa trên inverseMass, điều này là vật lý chính xác.
                    // objA.userData.inverseMass và objB.userData.inverseMass tự động đảm bảo rằng:
                    // - Nếu massA >> massB (objA nặng hơn nhiều), objA.inverseMass gần 0, objB.inverseMass lớn.
                    //   -> velocityA thay đổi rất ít, velocityB thay đổi nhiều.
                    // - Nếu massB >> massA (objB nặng hơn nhiều), objB.inverseMass gần 0, objA.inverseMass lớn.
                    //   -> velocityB thay đổi rất ít, velocityA thay đổi nhiều.
                    // - Nếu massA == massB, cả hai thay đổi như nhau.

                    // Điều này đã đáp ứng yêu cầu của bạn về mặt vật lý.
                    // Nếu bạn muốn hiệu ứng mạnh hơn (ví dụ: vật nặng hoàn toàn không di chuyển),
                    // bạn có thể thêm một ngưỡng khối lượng và gán inverseMass = 0 cho vật nặng
                    // trong trường hợp va chạm với vật nhẹ, nhưng điều này sẽ phá vỡ vật lý thực tế.
                    // Hiện tại, chúng ta đã có đủ để thấy vật nặng ít bị ảnh hưởng hơn.
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
    const baseDrag = 100; // Giữ giá trị này để thấy hiệu ứng khối lượng
    const effectiveDragCoefficient = baseDrag / userData.mass; 

    if (userData.velocity.lengthSq() > 0.0001) { 
        const airResistanceForce = userData.velocity.clone().normalize().multiplyScalar(-effectiveDragCoefficient * userData.velocity.length());
        userData.forces.add(airResistanceForce);
    }

    // 3. Tính toán gia tốc (a = F / m)
    const acceleration = userData.forces.clone().multiplyScalar(userData.inverseMass);

    // 4. Cập nhật vận tốc (v = v0 + a * dt)
    userData.velocity.add(acceleration.multiplyScalar(fixedDeltaTime));

    // 5. LOẠI BỎ hoặc GIẢM ĐI damping chung để hiệu ứng air resistance hoạt động rõ ràng hơn
    // userData.velocity.multiplyScalar(0.99); // Bỏ comment hoặc đổi thành 1.0 nếu muốn loại bỏ hoàn toàn

    // 6. Cập nhật vị trí (p = p0 + v * dt)
    object.position.add(userData.velocity.clone().multiplyScalar(fixedDeltaTime));

    // 7. Reset lực tác dụng cho frame tiếp theo
    userData.forces.set(0, 0, 0);

    // Xử lý va chạm với mặt đất (để vật thể không rơi xuyên qua)
    if (userData.halfExtents) {
        const bottomY = object.position.y - userData.halfExtents.y;
        const groundLevel = 0; // Giả sử mặt đất ở y = 0
        const minVelocityThreshold = 0.1; // Ngưỡng vận tốc tối thiểu để dừng hẳn

        if (bottomY < groundLevel) {
            object.position.y = groundLevel + userData.halfExtents.y; // Đặt vật thể lên mặt đất
            
            if (userData.velocity.y < 0) { // Chỉ xử lý khi đang rơi xuống
                // Giảm nảy hoặc dừng hẳn nếu vận tốc nhỏ
                if (Math.abs(userData.velocity.y) < minVelocityThreshold) {
                    userData.velocity.y = 0; // Dừng hẳn nếu vận tốc quá nhỏ
                } else {
                    userData.velocity.y *= -0.1; // Bật nảy rất nhẹ (giảm từ 0.3 xuống 0.1)
                }
            }
        }
    }
}
