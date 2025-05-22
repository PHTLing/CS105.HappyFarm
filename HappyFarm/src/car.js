// car.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function createCar() {
    // Load car model
    const loader = new GLTFLoader();
    const carModelUrl = '/assets/Truck.glb'; // Đường dẫn đến mô hình xe hơi
    return new Promise((resolve, reject) => {
        loader.load(
            carModelUrl,
            (gltf) => {
                const car = gltf.scene;
                car.rotateY(Math.PI); // Xoay mô hình nếu cần
                car.scale.set(1, 1, 1);
                car.position.y = 0.25;
                resolve(car); // trả về car
            },
            undefined,
            (error) => {
                console.error('Error loading car model:', error);
                reject(error);
            }
        );
    });
}

export function updateCar(car, keyState) {
    const speed = 0.2;
    const rotationSpeed = 0.05;

    // Xoay xe
    if (keyState['a']) {
        car.rotation.y -= rotationSpeed;
    }
    if (keyState['d']) {
        car.rotation.y += rotationSpeed;
    }

    // Vector hướng tiến về phía đầu xe
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(car.quaternion);

    // Di chuyển xe theo hướng đầu xe
    if (keyState['w']) {
        car.position.add(forward.clone().multiplyScalar(speed));
    }
    if (keyState['s']) {
        car.position.add(forward.clone().multiplyScalar(-speed));
    }
}

export class CarController {
    constructor(carMesh) {
        this.car = carMesh;

        // Tốc độ
        this.currentSpeed = 0;
        this.maxSpeed = 0.1;
        this.acceleration = 0.002;
        this.deceleration = 0.002;
        this.brakeDeceleration = 0.05;
        this.boostMultiplier = 2;

        // Xoay
        this.currentRotationSpeed = 0;
        this.maxRotationSpeed = 0.02;
        this.rotationAcceleration = 0.004;
        this.rotationDeceleration = 0.008;
        this.driftFactor = 2.5; // hệ số drift
    }

    update(keyState) {
        const isBoosting = keyState['ShiftLeft'];
        const isBraking = keyState[' ']; // Space
        const isDrifting = isBoosting && (keyState['a'] || keyState['d']);
        // Tăng giảm tốc độ tiến/lùi
        if (keyState['w']) {
            let acc = this.acceleration * (isBoosting ? this.boostMultiplier : 1);
            this.currentSpeed += acc;
            if (this.currentSpeed > this.maxSpeed * (isBoosting ? this.boostMultiplier : 1)) {
                this.currentSpeed = this.maxSpeed * (isBoosting ? this.boostMultiplier : 1);
            }
        } else if (keyState['s']) {
            this.currentSpeed -= this.acceleration;
            if (this.currentSpeed < -this.maxSpeed / 2) {
                this.currentSpeed = -this.maxSpeed / 2;
            }
        } else if (isBraking) {
            // Phanh gấp
            if (this.currentSpeed > 0) {
                this.currentSpeed -= this.brakeDeceleration;
                if (this.currentSpeed < 0) this.currentSpeed = 0;
            } else if (this.currentSpeed < 0) {
                this.currentSpeed += this.brakeDeceleration;
                if (this.currentSpeed > 0) this.currentSpeed = 0;
            }
        } else {
            if (this.currentSpeed > 0) {
                this.currentSpeed -= this.deceleration;
                if (this.currentSpeed < 0) this.currentSpeed = 0;
            } else if (this.currentSpeed < 0) {
                this.currentSpeed += this.deceleration;
                if (this.currentSpeed > 0) this.currentSpeed = 0;
            }
        }

        // Tăng giảm tốc độ xoay (drift tăng hệ số xoay)
        let rotationAccel = this.rotationAcceleration;
        let maxRot = this.maxRotationSpeed;
        if (isDrifting) {
            rotationAccel *= this.driftFactor;
            maxRot *= this.driftFactor;
        }

        if (keyState['a']) {
            this.currentRotationSpeed -= rotationAccel;
            if (this.currentRotationSpeed < -maxRot) this.currentRotationSpeed = -maxRot;
        } else if (keyState['d']) {
            this.currentRotationSpeed += rotationAccel;
            if (this.currentRotationSpeed > maxRot) this.currentRotationSpeed = maxRot;
        } else {
            if (this.currentRotationSpeed > 0) {
                this.currentRotationSpeed -= this.rotationDeceleration;
                if (this.currentRotationSpeed < 0) this.currentRotationSpeed = 0;
            } else if (this.currentRotationSpeed < 0) {
                this.currentRotationSpeed += this.rotationDeceleration;
                if (this.currentRotationSpeed > 0) this.currentRotationSpeed = 0;
            }
        }

        // Cập nhật góc xoay và vị trí xe
        this.car.rotation.y += this.currentRotationSpeed;
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.car.quaternion);
        this.car.position.add(forward.multiplyScalar(this.currentSpeed));
    }
}
