import * as THREE from 'three';

/**
 * Adds a bounding box to an object and its mesh children.
 * This bounding box is used for collision detection.
 * @param {THREE.Object3D} object The object to add bounding box to.
 */
export function addBoundingBox(object) {
    object.traverse((child) => {
        if (child.isMesh) {
            child.geometry.computeBoundingBox();
            child.boundingBox = child.geometry.boundingBox.clone();
        }
    });

    // Tính toán bounding box tổng thể cho toàn bộ object (bao gồm tất cả mesh con)
    const boundingBox = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    if (!object.userData) object.userData = {};
    object.userData.halfExtents = size.multiplyScalar(0.5); // Lưu vào userData của object chính
}

/**
 * Sets the mass and initializes physics-related properties for a given object.
 * @param {THREE.Object3D} object The object to set mass for.
 * @param {number} mass The mass of the object.
 */
export function setMass(object, mass) {
    // Khởi tạo userData nếu chưa có
    if (!object.userData) object.userData = {};

    // Lưu trữ mass và inverseMass (đảo ngược của khối lượng)
    object.userData.mass = mass;
    object.userData.inverseMass = mass > 0 ? 1 / mass : 0; // Thêm inverseMass để tối ưu tính toán
    object.userData.isDynamic = mass > 0; // Đánh dấu là vật thể động nếu có khối lượng

    // === THÊM CÁC THUỘC TÍNH VẬT LÝ CẦN THIẾT ===
    // Đảm bảo các vector này luôn tồn tại và được reset đúng cách
    object.userData.velocity = object.userData.velocity || new THREE.Vector3(); // Vận tốc tuyến tính
    object.userData.angularVelocity = object.userData.angularVelocity || new THREE.Vector3(); // Vận tốc góc
    object.userData.forces = object.userData.forces || new THREE.Vector3(); // Các lực tác dụng trong frame
    object.userData.torque = object.userData.torque || new THREE.Vector3(); // Các mô-men xoắn trong frame (nếu bạn muốn mô phỏng mô-men xoắn phức tạp)
}

/**
 * Draws a visual representation of the bounding box for an object and its mesh children.
 * The helper boxes will be added as children of the respective meshes, so they move with the meshes.
 * @param {THREE.Object3D} object The object to draw bounding boxes for.
 * @param {number} [color=0xff0000] The color of the bounding box helper (default red).
 */
export function drawBoundingBox(object, color = 0x00ff00) {
    object.traverse((child) => {
        if (child.isMesh && child.boundingBox) {
            // Remove existing helper if any to avoid duplicates on re-draw
            if (child._boundingBoxHelper) {
                child.remove(child._boundingBoxHelper);
            }

            // Create a Box3Helper for the mesh's local bounding box
            const helper = new THREE.Box3Helper(child.boundingBox, color);
            // Add the helper as a child of the mesh itself.
            // This ensures the helper automatically transforms with the mesh.
            child.add(helper);
            // Store a reference to the helper on the mesh for easy removal/update later
            child._boundingBoxHelper = helper;
        }
    });
}