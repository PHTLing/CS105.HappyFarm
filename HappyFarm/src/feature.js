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

            // Tính toán và lưu halfExtents vào userData của đối tượng cha (hoặc mesh con nếu bạn muốn vật lý từng phần)
            // Đối với mục đích va chạm tổng thể, chúng ta thường cần bounding box của toàn bộ đối tượng
            // Nếu bạn muốn mỗi mesh con có halfExtents riêng, hãy thêm vào child.userData
            // Nhưng nếu object là một Group (như carGroup), bạn nên tính toán cho Group đó.
            // Để đơn giản, ta sẽ tính cho vật thể chính (object)
        }
    });

    // Tính toán bounding box tổng thể cho toàn bộ object (bao gồm tất cả mesh con)
    // Điều này quan trọng để userData.halfExtents phản ánh kích thước tổng thể
    const boundingBox = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    if (!object.userData) object.userData = {};
    object.userData.halfExtents = size.multiplyScalar(0.5); // Lưu vào userData của object chính
}

/**
 * Sets the mass and initializes velocity for a given object.
 * @param {THREE.Object3D} object The object to set mass for.
 * @param {number} mass The mass of the object.
 */

export function setMass(object, mass) {
    // Khởi tạo userData nếu chưa có
    if (!object.userData) object.userData = {};

    // Lưu trữ mass và velocity vào userData
    object.userData.mass = mass;
    object.userData.inverseMass = mass > 0 ? 1 / mass : 0; // Thêm inverseMass để tối ưu tính toán
    object.userData.velocity = new THREE.Vector3(); // Initialize velocity vector
    object.userData.forces = new THREE.Vector3(); // Initialize forces vector
    object.userData.isDynamic = mass > 0; // Đánh dấu là vật thể động nếu có khối lượng
}
// export function setMass(object, mass) {
//     object.userData = object.userData || {};
//     object.userData.mass = mass;
//     object.userData.inverseMass = mass === 0 ? 0 : 1 / mass; // 0 for static, 1/mass for dynamic
//     object.userData.isDynamic = mass > 0; // If mass is greater than 0, it's dynamic
//     object.userData.velocity = new THREE.Vector3();
//     object.userData.angularVelocity = new THREE.Vector3();
//     object.userData.isFalling = false; // Add falling state

//     // Compute bounding box and half extents
//     const bbox = new THREE.Box3().setFromObject(object);
//     // Tính toán lại kích thước của bounding box cho TallBox
//     // và đặt gốc của nó ở chân.
//     if (object.name && object.name.startsWith('TallBox_')) {
//         // Đối với TallBox, chúng ta muốn pivot point ở chân
//         const originalHeight = bbox.max.y - bbox.min.y;
//         object.userData.groundY = object.position.y - originalHeight / 2; // Lưu trữ vị trí mặt đất ban đầu của chân
//         object.position.y = object.userData.groundY + originalHeight / 2; // Đảm bảo vị trí Y của mesh là tâm của BBox
//         bbox.setFromObject(object); // Tính lại bbox sau khi điều chỉnh vị trí
//     }

//     object.userData.halfExtents = new THREE.Vector3(
//         (bbox.max.x - bbox.min.x) / 2,
//         (bbox.max.y - bbox.min.y) / 2,
//         (bbox.max.z - bbox.min.z) / 2
//     );
// }

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
