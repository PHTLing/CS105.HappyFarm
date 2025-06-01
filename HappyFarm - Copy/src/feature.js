// feature.js
import * as THREE from 'three';
import * as CANNON from 'cannon-es'; // <-- Đảm bảo import CANNON ở đây nếu bạn muốn vẽ debug BBox dựa trên Cannon.js shape

/**
 * Sets the mass and initializes velocity for a given object.
 * @param {THREE.Object3D} object The object to set mass for.
 * @param {number} mass The mass of the object.
 */
export function setMass(object, mass) {
    if (!object.userData) object.userData = {};
    object.userData.mass = mass;
}

/**
 * Draws a bounding box helper around the given Three.js object.
 * This is useful for debugging the visual representation of the physics shape.
 * @param {THREE.Object3D} object The Three.js object to draw the bounding box for.
 * @param {THREE.Scene} scene The Three.js scene to add the helper to.
 * @param {number} [color=0x00ff00] The color of the bounding box.
 */
export function drawBoundingBox(object, scene, color = 0x00ff00) {
    if (!object.userData || !object.userData.cannonShapeType) {
        console.warn("Object does not have 'cannonShapeType' in userData. Cannot draw physics bounding box.");
        return;
    }

    let bboxMesh;
    const material = new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: 0.2 });

    switch (object.userData.cannonShapeType) {
        case 'Box':
            const halfExtents = object.userData.cannonHalfExtents || new CANNON.Vec3(0.5, 0.5, 0.5);
            const boxGeometry = new THREE.BoxGeometry(
                halfExtents.x * 2,
                halfExtents.y * 2,
                halfExtents.z * 2
            );
            bboxMesh = new THREE.Mesh(boxGeometry, material);
            break;
        case 'Sphere':
            const radius = object.userData.cannonRadius || 0.5;
            const sphereGeometry = new THREE.SphereGeometry(radius, 16, 16);
            bboxMesh = new THREE.Mesh(sphereGeometry, material);
            break;
        case 'Cylinder':
            const cylRadius = object.userData.cannonRadius || 0.5;
            const cylHeight = object.userData.cannonHeight || 1;
            const cylSegments = object.userData.cannonNumSegments || 12;
            const cylinderGeometry = new THREE.CylinderGeometry(cylRadius, cylRadius, cylHeight, cylSegments);
            bboxMesh = new THREE.Mesh(cylinderGeometry, material);
            // Three.js cylinders are aligned with Y, Cannon.js cylinders are aligned with X by default.
            // So we need to rotate the debug mesh to match Cannon.js's internal rotation if needed.
            // However, in physics.js we rotate the CANNON.Body for Cylinder, so the THREE.Mesh will align.
            // If the Cannon.Body is aligned with Y, no rotation needed here.
            // If Cannon.Body was rotated to X, then this debug mesh would need to rotate -Math.PI/2 around X.
            // Assuming your Cannon.js cylinder body is already aligned with Y due to initial rotation:
            // No additional rotation needed here.
            break;
        case 'Plane':
            // For a plane, a simple large box or plane mesh can represent its extent for debugging.
            // Cannon.js Plane is infinite, so this is just a visual aid.
            const planeGeometry = new THREE.PlaneGeometry(100, 100); // Represent a large area
            bboxMesh = new THREE.Mesh(planeGeometry, material);
            bboxMesh.rotation.x = -Math.PI / 2; // Orient it flat on the XZ plane
            break;
        default:
            console.warn(`Cannot draw debug bounding box for unsupported Cannon.js shape type: ${object.userData.cannonShapeType}`);
            return;
    }

    if (bboxMesh) {
        // Position the debug mesh relative to the object's origin.
        // It should follow the object's position and rotation in the Three.js scene.
        bboxMesh.position.copy(object.position);
        bboxMesh.quaternion.copy(object.quaternion);
        // Important: Make the debug mesh a child of the object (or its parent)
        // so it moves with the object. If added directly to scene, it will be static.
        // Or, update its position/quaternion in the main loop like the objects.
        // For simplicity, we add it to the scene and let it be updated in physicsManager.update.
        // Or, you can make it a child of the object for automatic updates.
        // If it's a child of the object, position/quaternion will be relative.
        // For debugging, often it's better to add to scene and update in physicsManager loop.
        scene.add(bboxMesh);
        object.userData.debugBBox = bboxMesh; // Store reference to remove/update later
    }
}