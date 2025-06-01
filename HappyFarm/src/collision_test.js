// collision.js
import * as THREE from 'three';

export class CollisionManager {
    constructor(carGroup, interactiveObjects, carController) {
        this.car = carGroup;
        this.objects = interactiveObjects; // Đây là mảng các đối tượng interactive đã có halfExtents từ ObjectManager
        this.allCollidableObjects = [this.car, ...this.objects]; // Đảm bảo carGroup được thêm vào
        this.clock = new THREE.Clock();
        this.carController = carController;
    }

    updateCollisions() {
        const delta = this.clock.getDelta();

        // Cập nhật vị trí các vật thể ĐỘNG (không phải xe) dựa trên vận tốc
        // và xử lý việc đổ cây (angular velocity)
        for (const obj of this.allCollidableObjects) {
            // Chỉ áp dụng logic này cho các vật thể động, KHÔNG phải xe, và KHÔNG đang đổ
            if (obj !== this.car && obj.userData && obj.userData.velocity && obj.userData.isDynamic && !obj.userData.isFalling) {
                obj.position.add(obj.userData.velocity.clone().multiplyScalar(delta));

                const frictionFactor = 0.96;
                if (obj.userData.velocity.lengthSq() > 0.0001) {
                    obj.userData.velocity.multiplyScalar(frictionFactor);
                } else {
                    obj.userData.velocity.set(0, 0, 0);
                }
            }

            // Xử lý việc đổ cây (angular velocity)
            if (obj.userData && obj.userData.isFalling) {
                if (obj.userData.angularVelocity && obj.userData.angularVelocity.lengthSq() > 0.00001) {
                    const angularSpeed = obj.userData.angularVelocity.length();
                    const rotationAngle = angularSpeed * delta;
                    const rotationAxis = obj.userData.angularVelocity.clone().normalize();

                    const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, rotationAngle);
                    obj.quaternion.multiply(rotationQuaternion);

                    obj.userData.angularVelocity.multiplyScalar(0.8);

                    if (!obj.userData.currentRotationAngle) obj.userData.currentRotationAngle = 0;
                    obj.userData.currentRotationAngle += rotationAngle;

                    const maxFallAngle = Math.PI / 2; // 90 độ
                    if (obj.userData.currentRotationAngle >= maxFallAngle) {
                        obj.userData.isFalling = false;
                        obj.userData.angularVelocity.set(0, 0, 0);
                        obj.userData.currentRotationAngle = maxFallAngle;
                        
                        obj.quaternion.setFromAxisAngle(rotationAxis, maxFallAngle);

                        const tempBox = new THREE.Box3().setFromObject(obj);
                        obj.position.y = obj.userData.groundY + (tempBox.max.y - tempBox.min.y) / 2;

                        console.log("Tree has fallen completely!");
                    }
                } else {
                    obj.userData.isFalling = false;
                    obj.userData.angularVelocity.set(0, 0, 0);
                    obj.userData.currentRotationAngle = 0;
                }
            }
        }

        // Kiểm tra va chạm giữa các cặp đối tượng
        for (let i = 0; i < this.allCollidableObjects.length; i++) {
            for (let j = i + 1; j < this.allCollidableObjects.length; j++) {
                const objA = this.allCollidableObjects[i];
                const objB = this.allCollidableObjects[j];

                // THAY ĐỔI QUAN TRỌNG: Lọc bỏ các đối tượng không hợp lệ sớm
                // Nếu bất kỳ đối tượng nào không có userData HOẶC không có halfExtents (như Scene), bỏ qua.
                if (!objA || !objB || !objA.userData?.halfExtents || !objB.userData?.halfExtents) {
                    // console.warn(`Skipping invalid collision pair: ${objA?.name || 'Unnamed'} (${objA?.uuid}) vs ${objB?.name || 'Unnamed'} (${objB?.uuid}). Missing userData or halfExtents.`);
                    continue;
                }

                // Không xử lý va chạm giữa hai vật thể tĩnh
                const isADynamic = objA.userData.isDynamic;
                const isBDynamic = objB.userData.isDynamic;
                if (!isADynamic && !isBDynamic) {
                    continue;
                }

                // Kiểm tra va chạm AABB
                if (this._checkAABBCollision(objA, objB)) {
                    this._resolveCollision(objA, objB);
                }
            }
        }
    }

    _checkAABBCollision(objA, objB) {
        const posA = objA.position;
        const halfExtA = objA.userData.halfExtents;
        const posB = objB.position;
        const halfExtB = objB.userData.halfExtents;

        return (
            Math.abs(posA.x - posB.x) < (halfExtA.x + halfExtB.x) &&
            Math.abs(posA.y - posB.y) < (halfExtA.y + halfExtB.y) &&
            Math.abs(posA.z - posB.z) < (halfExtA.z + halfExtB.z)
        );
    }

    _resolveCollision(objA, objB) {
        // DEBUG LOGGING ĐẦY ĐỦ:
        console.log(`--- DEBUG: Collision Detected ---`);
        console.log(`ObjA: ${objA.name || 'Unnamed'} (Dynamic: ${objA.userData?.isDynamic}, Mass: ${objA.userData?.mass}, Velocity: ${objA.userData?.velocity?.length().toFixed(2)})`);
        console.log(`ObjB: ${objB.name || 'Unnamed'} (Dynamic: ${objB.userData?.isDynamic}, Mass: ${objB.userData?.mass}, Velocity: ${objB.userData?.velocity?.length().toFixed(2)})`);

        const massA = objA.userData.mass || 0;
        const massB = objB.userData.mass || 0;
        const velA = objA.userData.velocity; // Velocity của ObjA (nếu không phải xe)
        const velB = objB.userData.velocity; // Velocity của ObjB (nếu không phải xe)

        const isADynamic = objA.userData.isDynamic;
        const isBDynamic = objB.userData.isDynamic;

        const deltaPos = new THREE.Vector3().subVectors(objB.position, objA.position);
        const halfExtA = objA.userData.halfExtents;
        const halfExtB = objB.userData.halfExtents;

        const overlapX = (halfExtA.x + halfExtB.x) - Math.abs(deltaPos.x);
        const overlapY = (halfExtA.y + halfExtB.y) - Math.abs(deltaPos.y);
        const overlapZ = (halfExtA.z + halfExtB.z) - Math.abs(deltaPos.z);

        let minOverlap = 0;
        let mtv = new THREE.Vector3(); // Minimum Translation Vector

        if (overlapX < overlapY && overlapX < overlapZ) {
            minOverlap = overlapX;
            mtv.x = Math.sign(deltaPos.x);
        } else if (overlapY < overlapX && overlapY < overlapZ) {
            minOverlap = overlapY;
            mtv.y = Math.sign(deltaPos.y);
        } else {
            minOverlap = overlapZ;
            mtv.z = Math.sign(deltaPos.z);
        }

        if (minOverlap <= 0) return; // Không có overlap thực sự

        const separationEpsilon = 0.01;
        const separationDistance = minOverlap + separationEpsilon;

        // --- Đẩy lùi vật thể ra khỏi nhau (Position Correction) ---
        if (isADynamic && isBDynamic) {
            const totalInverseMass = objA.userData.inverseMass + objB.userData.inverseMass;
            if (totalInverseMass === 0) return;
            const separationA = separationDistance * (objA.userData.inverseMass / totalInverseMass);
            const separationB = separationDistance * (objB.userData.inverseMass / totalInverseMass);

            objA.position.add(mtv.clone().multiplyScalar(-separationA));
            objB.position.add(mtv.clone().multiplyScalar(separationB));
        } else if (isADynamic) {
            objA.position.add(mtv.clone().multiplyScalar(-separationDistance));
        } else if (isBDynamic) {
            objB.position.add(mtv.clone().multiplyScalar(separationDistance));
        }

        // --- Tính toán vận tốc va chạm và xử lý xung lượng ---
        let currentVelA = new THREE.Vector3();
        let currentVelB = new THREE.Vector3();

        // Lấy vận tốc chính xác cho objA
        if (objA === this.car) {
            currentVelA.copy(this.carController.carGroup.getWorldDirection(new THREE.Vector3()).multiplyScalar(this.carController.currentSpeed));
        } else if (isADynamic && velA) {
            currentVelA.copy(velA);
        }

        // Lấy vận tốc chính xác cho objB
        if (objB === this.car) {
            currentVelB.copy(this.carController.carGroup.getWorldDirection(new THREE.Vector3()).multiplyScalar(this.carController.currentSpeed));
        } else if (isBDynamic && velB) {
            currentVelB.copy(velB);
        }
        
        const relativeVelocity = new THREE.Vector3().subVectors(currentVelB, currentVelA);
        const collisionNormal = mtv.normalize();
        const normalVelocity = relativeVelocity.dot(collisionNormal);

        if (normalVelocity > 0) {
            return;
        }

        const restitution = 0.1;
        let impulseMagnitude = -(1 + restitution) * normalVelocity;
        let totalInverseMassForImpulse = 0;

        if (isADynamic) totalInverseMassForImpulse += objA.userData.inverseMass;
        if (isBDynamic) totalInverseMassForImpulse += objB.userData.inverseMass;

        if (totalInverseMassForImpulse === 0) return;

        impulseMagnitude /= totalInverseMassForImpulse;

        const impulse = collisionNormal.clone().multiplyScalar(impulseMagnitude);

        // Áp dụng xung lượng
        if (isADynamic) {
            if (objA === this.car) {
                const speedChange = impulse.dot(this.carController.carGroup.getWorldDirection(new THREE.Vector3())) * objA.userData.inverseMass;
                this.carController.currentSpeed -= speedChange;
                this.carController.currentSpeed = Math.max(-this.carController.maxSpeed / 2, Math.min(this.carController.maxSpeed * this.carController.boostMultiplier, this.carController.currentSpeed));
                console.log(`Car speed adjusted to: ${this.carController.currentSpeed.toFixed(2)}`);
            } else {
                velA.sub(impulse.clone().multiplyScalar(objA.userData.inverseMass));
            }
        }
        if (isBDynamic) {
            if (objB === this.car) {
                const speedChange = impulse.dot(this.carController.carGroup.getWorldDirection(new THREE.Vector3())) * objB.userData.inverseMass;
                this.carController.currentSpeed += speedChange;
                this.carController.currentSpeed = Math.max(-this.carController.maxSpeed / 2, Math.min(this.carController.maxSpeed * this.carController.boostMultiplier, this.carController.currentSpeed));
                console.log(`Car speed adjusted to: ${this.carController.currentSpeed.toFixed(2)}`);
            } else {
                velB.add(impulse.clone().multiplyScalar(objB.userData.inverseMass));
            }
        }

        // --- Logic Xử Lý Hiệu Ứng Đổ Cây ---
        let affectedObject = null;
        let impactingObject = null;

        // Xác định đối tượng TallBox và đối tượng gây va chạm
        if (objA.name && objA.name.startsWith('TallBox_') && objA.userData && objA.userData.isDynamic && objA.userData.mass > 0) {
            affectedObject = objA;
            impactingObject = objB;
        } else if (objB.name && objB.name.startsWith('TallBox_') && objB.userData && objB.userData.isDynamic && objB.userData.mass > 0) {
            affectedObject = objB;
            impactingObject = objA;
        }

        console.log(`--- DEBUG: Checking TallBox Fall Logic ---`);
        console.log(`Affected Object (TallBox): ${affectedObject?.name || 'None'}`);
        console.log(`Impacting Object: ${impactingObject?.name || 'None'}`);


        if (affectedObject && impactingObject) {
            let actualImpactingVelocity = new THREE.Vector3();

            // Nếu impactingObject là xe, lấy vận tốc từ carController
            if (impactingObject === this.car) {
                const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.carController.carGroup.quaternion);
                actualImpactingVelocity.copy(carForward).multiplyScalar(this.carController.currentSpeed);
                console.log(`Impacting object is CAR. Actual Speed: ${this.carController.currentSpeed.toFixed(2)}, Calc Velocity Length: ${actualImpactingVelocity.length().toFixed(2)}`);
            }
            // Nếu impactingObject là đối tượng động khác, lấy từ userData.velocity
            else if (impactingObject.userData && impactingObject.userData.isDynamic && impactingObject.userData.velocity) {
                actualImpactingVelocity.copy(impactingObject.userData.velocity);
                console.log(`Impacting object is another dynamic object. Velocity Length: ${actualImpactingVelocity.length().toFixed(2)}`);
            } else {
                console.warn("Impacting object is neither car nor a valid dynamic object with velocity. Skipping TallBox fall logic.");
                return;
            }

            const minImpactSpeedSq = 0.1;
            const currentImpactSpeedSq = actualImpactingVelocity.lengthSq();

            console.log(`TallBox is currently falling: ${affectedObject.userData.isFalling}`);
            console.log(`Impacting Object Velocity Sq: ${currentImpactSpeedSq.toFixed(2)}`);
            console.log(`Min Impact Speed Sq required: ${minImpactSpeedSq}`);
            console.log(`Is Impact Speed enough? ${currentImpactSpeedSq > minImpactSpeedSq}`);


            if (!affectedObject.userData.isFalling) {
                if (currentImpactSpeedSq > minImpactSpeedSq) {
                    console.log(`*** TallBox ${affectedObject.name} is starting to fall! ***`);

                    const impactDirection = new THREE.Vector3().subVectors(affectedObject.position, impactingObject.position).normalize();
                    impactDirection.y = 0;

                    if (impactDirection.lengthSq() === 0) {
                        console.warn("Direct vertical impact or no clear horizontal direction. Not initiating fall.");
                        return;
                    }
                    impactDirection.normalize();

                    const rotationAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), impactDirection).normalize();

                    const fallStrength = 20;
                    if (!affectedObject.userData.angularVelocity) {
                        affectedObject.userData.angularVelocity = new THREE.Vector3();
                    }

                    affectedObject.userData.angularVelocity.add(rotationAxis.multiplyScalar(fallStrength * actualImpactingVelocity.length()));
                    affectedObject.userData.isFalling = true;

                    // Lưu trữ thông tin cần thiết cho quá trình đổ
                    affectedObject.geometry.computeBoundingBox();
                    const bbox = affectedObject.geometry.boundingBox;
                    affectedObject.userData.originalHalfExtents = new THREE.Vector3(
                        (bbox.max.x - bbox.min.x) / 2,
                        (bbox.max.y - bbox.min.y) / 2,
                        (bbox.max.z - bbox.min.z) / 2
                    );
                } else {
                    console.log(`Impact speed (${Math.sqrt(currentImpactSpeedSq).toFixed(2)}) is below threshold (${Math.sqrt(minImpactSpeedSq).toFixed(2)}). TallBox will not fall.`);
                }
            } else {
                console.log("TallBox is already falling, ignoring new impact.");
            }
        } else {
            console.log("No valid affectedObject (TallBox) or impactingObject found for fall logic.");
        }

        // Giảm vận tốc cho các vật thể động, KHÔNG phải xe
        if (isADynamic && objA !== this.car && !objA.userData.isFalling) velA.multiplyScalar(0.95);
        if (isBDynamic && objB !== this.car && !objB.userData.isFalling) velB.multiplyScalar(0.95);
    }
}