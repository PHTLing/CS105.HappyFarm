import * as THREE from 'three';

export function createCamera(gameWindow) {
    // Camera 
    const LEFT_MOUSE_BUTTON = 0;
    const MIDDLE_MOUSE_BUTTON = 1;
    const RIGHT_MOUSE_BUTTON = 2;

    const MIN_CAMERA_RADIUS = 2;
    const MAX_CAMERA_RADIUS = 10;
    const MIN_CAMERA_ELEVATION = 10;
    const MAX_CAMERA_ELEVATION = 90;

    const Y_AXIS = new THREE.Vector3(0, 1, 0);

    const ROTATION_SENSITIVITY = 0.5;
    const ZOOM_SENSITIVITY = 0.02;
    const PAN_SENSITIVITY = -0.01;
    const camera = new THREE.PerspectiveCamera(75, gameWindow.clientWidth / gameWindow.clientHeight, 0.1, 1000);
    const cameraOrigin = new THREE.Vector3(0, 0, 0);
    let cameraRadius = 4;
    let cameraAzimuth = 0;
    let cameraElevation = 10;
    let isleftMouseDown = false;
    let isrightMouseDown = false;
    let ismiddleMouseDown = false;
    let preMouseX = 0;
    let preMouseY = 0;

    // Set target object
    let targetObject = null;
    let followMode = false;

    updateCameraPosition();

    function setTarget(object) {
        targetObject = object;
    }

    function setFollowMode(enabled) {
        followMode = enabled;
    }

    function onMouseDown(event) {
        console.log('mousedown');
        
        if (event.button === LEFT_MOUSE_BUTTON) {
            isleftMouseDown = true;
        }
        if (event.button === MIDDLE_MOUSE_BUTTON) {
            ismiddleMouseDown = true;
        }
        if (event.button === RIGHT_MOUSE_BUTTON) {
            isrightMouseDown = true;
        }
    }

    function onMouseUp(event) {
        console.log('mouseup');
        if (event.button === LEFT_MOUSE_BUTTON) {
            isleftMouseDown = false;
        }
        if (event.button === MIDDLE_MOUSE_BUTTON) {
            ismiddleMouseDown = false;
        }
        if (event.button === RIGHT_MOUSE_BUTTON) {
            isrightMouseDown = false;
        }
    }

    function onMouseMove(event) {
        console.log('mousemove');

        const deltaX = event.clientX - preMouseX;
        const deltaY = event.clientY - preMouseY;
        if (!followMode) {        
            // Handle the rotation of the camera
            if (isleftMouseDown) {
                cameraAzimuth += -(deltaX * ROTATION_SENSITIVITY);
                cameraElevation += (deltaY * ROTATION_SENSITIVITY);
                cameraElevation = Math.min(MAX_CAMERA_ELEVATION, Math.max(MIN_CAMERA_ELEVATION, cameraElevation));
                updateCameraPosition();
            
            }

            //Handle the panning of the camera
            if (ismiddleMouseDown) {
                const forward = new THREE.Vector3(0,0,1).applyAxisAngle(Y_AXIS, THREE.MathUtils.degToRad(cameraAzimuth));
                const left = new THREE.Vector3(1,0,0).applyAxisAngle(Y_AXIS, THREE.MathUtils.degToRad(cameraAzimuth));
                cameraOrigin.add(forward.multiplyScalar(deltaY * PAN_SENSITIVITY));
                cameraOrigin.add(left.multiplyScalar(deltaX * PAN_SENSITIVITY));
                updateCameraPosition();
            }

            // Handle the zooming of the camera
            if (isrightMouseDown) {
                cameraRadius += deltaY * ZOOM_SENSITIVITY;
                cameraRadius = Math.min(MAX_CAMERA_RADIUS, Math.max(MIN_CAMERA_RADIUS, cameraRadius));
                updateCameraPosition();
            }
            preMouseX = event.clientX;
            preMouseY = event.clientY;
        } 
    }

    
    function updateCameraPosition() {
        if (followMode && targetObject) {
            // Theo sau target
            const offset = new THREE.Vector3(0, 3, -6).applyQuaternion(targetObject.quaternion);
            const desiredPosition = targetObject.position.clone().add(offset);

            camera.position.lerp(desiredPosition, 0.1);
            camera.lookAt(targetObject.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
        } else {
            // Tính vị trí theo tọa độ cameraOrigin + góc quay
            camera.position.x = cameraRadius * Math.sin(THREE.MathUtils.degToRad(cameraAzimuth)) * Math.cos(THREE.MathUtils.degToRad(cameraElevation));
            camera.position.y = cameraRadius * Math.sin(THREE.MathUtils.degToRad(cameraElevation));
            camera.position.z = cameraRadius * Math.cos(THREE.MathUtils.degToRad(cameraAzimuth)) * Math.cos(THREE.MathUtils.degToRad(cameraElevation));
            camera.position.add(cameraOrigin);
            camera.lookAt(cameraOrigin);
        }
        camera.updateMatrix();
    }

    return {
    camera,
    onMouseDown,
    onMouseUp,  
    onMouseMove,
    updateCameraPosition,
    setTarget,
    setFollowMode
    }
}