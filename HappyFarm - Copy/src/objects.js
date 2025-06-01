// objects.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { setMass } from './feature.js'; // Không cần addBoundingBox, drawBoundingBox nữa
import * as CANNON from 'cannon-es'; // <-- THÊM DÒNG NÀY

/**
 * Loads the car model and sets its initial properties.
 * @returns {Promise<{carGroup: THREE.Object3D, frontWheel_L: THREE.Object3D, frontWheel_R: THREE.Object3D, wheel_L: THREE.Object3D, wheel_R: THREE.Object3D, backWheels: THREE.Object3D, backRightWheelMesh: THREE.Object3D}>} 
 */
export function createCar() {
    const loader = new GLTFLoader();
    const carModelUrl = 'assets/models/Truck.glb'; 

    return new Promise((resolve, reject) => {
        loader.load(
            carModelUrl,
            (gltf) => {
                const carGroup = gltf.scene; 
                carGroup.rotateY(Math.PI);
                carGroup.scale.set(1, 1, 1); 
                
                const bbox = new THREE.Box3().setFromObject(carGroup);
                carGroup.position.y = -bbox.min.y; 
                
                carGroup.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true; 
                        node.receiveShadow = true;
                    }
                });
                
                // === Cập nhật userData cho Cannon.js ===
                // Cannon.js sẽ cần kích thước của bounding box để tạo hình dạng vật lý (shape)
                const size = new THREE.Vector3();
                bbox.getSize(size);
                if (!carGroup.userData) carGroup.userData = {};
                carGroup.userData.cannonShapeType = 'Box'; // Đánh dấu là hình hộp
                carGroup.userData.cannonHalfExtents = size.multiplyScalar(0.5); // Kích thước nửa của hình hộp

                setMass(carGroup, 100); // Đặt khối lượng cho xe
                // Bỏ addBoundingBox(carGroup) và drawBoundingBox(carGroup)
                // drawBoundingBox(carGroup); // Nếu bạn muốn debug bounding box của Three.js vẫn được

                // Find the steering pivot objects (the "transparent boxes" / Empties) ---
                const frontWheel_L = carGroup.getObjectByName('FrontWheel_L'); 
                const frontWheel_R = carGroup.getObjectByName('FrontWheel_R'); 
                const backWheels = carGroup.getObjectByName('BackWheels');

                // Find the actual wheel meshes (children) ---
                const wheel_L = frontWheel_L ? frontWheel_L.getObjectByName('Wheel_L') : null; 
                const wheel_R = frontWheel_R ? frontWheel_R.getObjectByName('Wheel_R') : null; 

                if (!frontWheel_L || !frontWheel_R || !wheel_L || !wheel_R || !backWheels) {
                    console.warn("Could not find steering pivot objects or wheel meshes. Steering/Rolling might not work as expected.");
                    console.warn("Expected names: 'frontWheel_L', 'frontWheel_R', 'wheel_L', wheel_R', 'backWheels'"); 
                    resolve({ 
                        carGroup: carGroup, 
                        frontWheel_L: null, frontWheel_R: null, 
                        wheel_L: null, wheel_R: null,
                        backWheels: null
                    });
                    return;
                }
                
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
                // Ví dụ: Farm.scale.set(1, 1, 1);
                // Ví dụ: Farm.rotateY(Math.PI); // Nếu mô hình của bạn cần xoay để đúng hướng
                
                const bbox = new THREE.Box3().setFromObject(Farm);
                Farm.position.y = -0.2; 
                
                Farm.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true; 
                        node.receiveShadow = true;
                    }
                });

                // === Cập nhật userData cho Cannon.js ===
                // Đối với Farm (map), bạn có thể coi nó là tĩnh (mass = 0) và hình dạng là Plane hoặc Mesh
                if (!Farm.userData) Farm.userData = {};
                Farm.userData.cannonShapeType = 'Trimesh'; // Hoặc 'Plane' nếu map đơn giản
                setMass(Farm, 0); // Mass = 0 nghĩa là vật thể tĩnh

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

/**
 * Creates the ground plane for the scene.
 * @param {number} width The width of the ground plane.
 * @param {number} height The height of the ground plane.
 * @param {THREE.Color} color The color of the ground plane.
 * @returns {THREE.Mesh} The created ground mesh.
 */
export function createGround(width, height, color) {
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({ color: color })
    );
    ground.rotation.x = -0.5 * Math.PI; 
    ground.receiveShadow = true; 

    // === Cập nhật userData cho Cannon.js ===
    if (!ground.userData) ground.userData = {};
    ground.userData.cannonShapeType = 'Plane'; // Hình dạng là Plane
    setMass(ground, 0); // Ground là vật thể tĩnh

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
        
        // ĐẢM BẢO DÒNG NÀY Ở ĐÂY
        const box = new THREE.Mesh(geometry, material); 
        
        geometry.translate(0, size / 2, 0); // Dịch chuyển geometry (ảnh hưởng đến BoundingBox)
        
        box.position.set(x, y, z);
        box.castShadow = true;
        box.receiveShadow = true;
        box.name = `Box_${this.interactiveObjects.length}`;

        if (!box.userData) box.userData = {};
        box.userData.cannonShapeType = 'Box';
        box.userData.cannonHalfExtents = new CANNON.Vec3(size / 2, size / 2, size / 2); 

        this.worldGroup.add(box);

        setMass(box, mass);
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
        
        // ĐẢM BẢO DÒNG NÀY Ở ĐÂY
        const box = new THREE.Mesh(geometry, material); 

        geometry.translate(0, height / 2, 0); // Dịch chuyển geometry
        box.position.set(x, y, z); 
        
        box.castShadow = true;
        box.receiveShadow = true;
        box.name = `TallBox_${this.interactiveObjects.length}`;

        if (!box.userData) box.userData = {};
        box.userData.cannonShapeType = 'Box';
        box.userData.cannonHalfExtents = new CANNON.Vec3(size / 2, height / 2, size / 2); 

        this.worldGroup.add(box);

        setMass(box, mass);
        box.userData.groundY = y; 
        box.userData.initialHeight = height; 
        box.userData.originalPosition = new THREE.Vector3(x, y, z); 

        this.interactiveObjects.push(box);
        return box;
    }
    
    createCylinder(x, y, z, radius, height, radialSegments, mass, color) {
        const geometry = new THREE.CylinderGeometry(radius, radius, height, radialSegments);
        const material = new THREE.MeshStandardMaterial({ color: color });
        
        // ĐẢM BẢO DÒNG NÀY Ở ĐÂY
        const cylinder = new THREE.Mesh(geometry, material);

        geometry.translate(0, height / 2, 0); 
        cylinder.position.set(x, y, z); 

        cylinder.castShadow = true;
        cylinder.receiveShadow = true;
        cylinder.name = `Cylinder_${this.interactiveObjects.length}`;

        if (!cylinder.userData) cylinder.userData = {};
        cylinder.userData.cannonShapeType = 'Cylinder';
        cylinder.userData.cannonRadius = radius;
        cylinder.userData.cannonHeight = height;
        cylinder.userData.cannonNumSegments = radialSegments; 

        this.worldGroup.add(cylinder);

        setMass(cylinder, mass);
        cylinder.userData.groundY = y;
        cylinder.userData.initialHeight = height;

        this.interactiveObjects.push(cylinder);
        return cylinder;
    }

    getInteractiveObjects() {
        return this.interactiveObjects;
    }
}
