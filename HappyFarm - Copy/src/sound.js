import * as THREE from 'three';

/**
 * Lớp SoundManager quản lý tất cả các âm thanh cho xe.
 */
export class SoundManager {
    /**
     * @param {THREE.AudioListener} listener - AudioListener gắn vào camera của cảnh.
     * @param {THREE.AudioLoader} audioLoader - AudioLoader để tải các tệp âm thanh.
     */
    constructor(listener, audioLoader) {
        this.listener = listener;
        this.audioLoader = audioLoader;

        this.backgroundSound = null;
        this.brakeSound = null;
        this.engineSound = null;
        this.hornTapSound = null;      // Âm thanh khi nhấn và nhả nhanh (horn_first.mp3)
        this.hornHoldLoopSound = null; // Âm thanh loop khi giữ (horn_second.mp3)

        // Trạng thái để quản lý việc phát âm thanh còi
        this.isHornKeyPressed = false;    // Theo dõi phím H có đang được giữ không
        this.hornPressTimer = null;       // Biến để lưu trữ setTimeout
        this.holdThreshold = 150;         // Ngưỡng thời gian (ms) để phân biệt tap/hold
        this.isHornPlayingLoop = false;   // Theo dõi xem có đang phát âm thanh loop (hornHoldLoopSound) không
    }

    /**
     * Tải tất cả các tệp âm thanh cần thiết.
     * @returns {Promise<void>} Một Promise sẽ giải quyết khi tất cả âm thanh đã được tải.
     */
    // async loadSounds()
    loadSounds() {
        const promises = [];

        promises.push(new Promise(resolve => {
            this.audioLoader.load('/assets/sounds/kids-game-gaming-background-music-295075.mp3', (buffer) => {
                this.backgroundSound = new THREE.Audio(this.listener);
                this.backgroundSound.setBuffer(buffer);
                this.backgroundSound.setVolume(0.0);
                this.backgroundSound.setLoop(true);
                resolve();
            });
        }));

        promises.push(new Promise(resolve => {
            this.audioLoader.load('/assets/sounds/brake_sound.mp3', (buffer) => {
                this.brakeSound = new THREE.Audio(this.listener);
                this.brakeSound.setBuffer(buffer);
                this.brakeSound.setVolume(0.5);
                resolve();
            });
        }));

        promises.push(new Promise(resolve => {
            // Âm thanh khi nhấn và nhả nhanh (horn_first.mp3)
            this.audioLoader.load('/assets/sounds/horn_first.mp3', (buffer) => {
                this.hornTapSound = new THREE.Audio(this.listener);
                this.hornTapSound.setBuffer(buffer);
                this.hornTapSound.setVolume(0.5);
                // Xử lý khi âm thanh tap kết thúc
                this.hornTapSound.onEnded = () => {
                    // Nếu không có loop nào đang chơi (nghĩa là nó là một cú tap thực sự)
                    if (!this.isHornPlayingLoop) {
                        // Đảm bảo không có timer đang chạy (vì đã là tap)
                        if (this.hornPressTimer) {
                            clearTimeout(this.hornPressTimer);
                            this.hornPressTimer = null;
                        }
                        this.isHornKeyPressed = false; // Reset trạng thái phím
                    }
                    // Nếu là hold, hornHoldLoopSound sẽ được bật và isHornPlayingLoop sẽ là true,
                    // nên phần này sẽ không reset isHornKeyPressed
                };
                resolve();
            });
        }));

        promises.push(new Promise(resolve => {
            // Âm thanh loop khi giữ phím (horn_second.mp3)
            this.audioLoader.load('/assets/sounds/horn_second.mp3', (buffer) => {
                this.hornHoldLoopSound = new THREE.Audio(this.listener);
                this.hornHoldLoopSound.setBuffer(buffer);
                this.hornHoldLoopSound.setVolume(0.5);
                this.hornHoldLoopSound.setLoop(true); // Âm thanh này sẽ tự lặp
                resolve();
            });
        }));

        promises.push(new Promise(resolve => {
            this.audioLoader.load('/assets/sounds/engine_short.mp3', (buffer) => {
                this.engineSound = new THREE.PositionalAudio(this.listener);
                this.engineSound.setBuffer(buffer);
                this.engineSound.setLoop(true);
                this.engineSound.setVolume(0.5); // **Đổi âm lượng về 0.3**
                resolve();
            });
        }));

        return Promise.all(promises);

        // await Promise.all(promises); // Thêm await ở đây

        // // Phát nhạc nền ngay sau khi tất cả âm thanh đã tải xong
        // if (this.backgroundSound && !this.backgroundSound.isPlaying) {
        //     this.backgroundSound.play();
        //     console.log("Nhạc nền đã bắt đầu phát.");
        // }
    }

    playBackGroundSound(){
        if (this.backgroundSound && !this.backgroundSound.isPlaying) {
            this.backgroundSound.play();
        }

    }

    playBrakeSound() {
        if (this.brakeSound && !this.brakeSound.isPlaying) {
            this.brakeSound.stop();
            this.brakeSound.play();
        }
    }

    /**
     * Quản lý trạng thái phát của tiếng còi.
     * @param {boolean} isHornKeyPressedNow - True nếu phím 'H' đang được nhấn TẠI THỜI ĐIỂM HIỆN TẠI.
     */
    manageHornSound(isHornKeyPressedNow) {
        if (isHornKeyPressedNow && !this.isHornKeyPressed) {
            // Mới nhấn phím 'H'
            this.isHornKeyPressed = true;
            this.isHornPlayingLoop = false; // Đảm bảo không có loop đang chạy khi bắt đầu

            // Luôn dừng âm thanh loop nếu nó đang chạy, để tránh xung đột
            if (this.hornHoldLoopSound && this.hornHoldLoopSound.isPlaying) {
                this.hornHoldLoopSound.stop();
            }
            // Dừng timer cũ nếu có
            if (this.hornPressTimer) {
                clearTimeout(this.hornPressTimer);
                this.hornPressTimer = null;
            }

            // Khởi động timer để kiểm tra "giữ phím"
            this.hornPressTimer = setTimeout(() => {
                // Nếu timer kích hoạt và phím vẫn đang giữ, thì đây là "giữ phím"
                if (this.isHornKeyPressed && this.hornHoldLoopSound) {
                    if (this.hornTapSound && this.hornTapSound.isPlaying) {
                        this.hornTapSound.stop(); // Dừng âm thanh tap nếu nó đang phát
                    }
                    this.hornHoldLoopSound.play();
                    this.isHornPlayingLoop = true; // Đánh dấu đang phát loop
                }
            }, this.holdThreshold);

            // Bắt đầu phát âm thanh "tap" ngay lập tức
            if (this.hornTapSound) {
                // Đảm bảo không bị chồng tiếng nếu gọi liên tục
                if (this.hornTapSound.isPlaying) {
                    this.hornTapSound.stop();
                }
                this.hornTapSound.play();
            }

        } else if (!isHornKeyPressedNow && this.isHornKeyPressed) {
            // Mới nhả phím 'H'
            this.isHornKeyPressed = false; // Cập nhật trạng thái phím

            // Xóa timer nếu nó chưa kịp kích hoạt (nghĩa là đây là một cú "tap" thực sự)
            if (this.hornPressTimer) {
                clearTimeout(this.hornPressTimer);
                this.hornPressTimer = null;
            }

            // Dừng âm thanh loop ngay lập tức nếu đang phát
            if (this.hornHoldLoopSound && this.hornHoldLoopSound.isPlaying) {
                this.hornHoldLoopSound.stop();
                this.isHornPlayingLoop = false;
            }
            // hornTapSound sẽ tự động phát hết nếu nó đang chạy và không bị dừng bởi hornHoldLoopSound
        }
    }

    // Đổi tên stopHornSound thành stopAllHornSounds để rõ ràng hơn
    stopAllHornSounds() {
        if (this.hornTapSound && this.hornTapSound.isPlaying) {
            this.hornTapSound.stop();
        }
        if (this.hornHoldLoopSound && this.hornHoldLoopSound.isPlaying) {
            this.hornHoldLoopSound.stop();
        }
        if (this.hornPressTimer) {
            clearTimeout(this.hornPressTimer);
            this.hornPressTimer = null;
        }
        this.isHornKeyPressed = false;
        this.isHornPlayingLoop = false;
    }

    /**
     * Cập nhật âm thanh động cơ dựa trên trạng thái di chuyển và boost.
     * @param {boolean} isMoving - True nếu xe đang di chuyển.
     * @param {boolean} isBoosting - True nếu xe đang boost.
     * @param {THREE.Object3D} carGroup - Nhóm xe để gắn PositionalAudio nếu sử dụng.
     */
    updateEngineSound(isMoving, isBoosting, carGroup) {
        if (!this.engineSound) return;

        // Nếu bạn dùng PositionalAudio, cần gắn nó vào carGroup
        if (this.engineSound instanceof THREE.PositionalAudio && this.engineSound.parent !== carGroup) {
            carGroup.add(this.engineSound);
        }

        const baseVolume = 3; // Đặt âm lượng cơ bản về 0.3 (trong khoảng 0.0 - 1.0)
        const boostedVolume = baseVolume * 2; // Âm lượng khi boost

        if (isMoving) {
            if (!this.engineSound.isPlaying) {
                this.engineSound.play();
            }

            let targetVolume = isBoosting ? boostedVolume : baseVolume;
            // targetVolume = Math.min(targetVolume, 1.0); // Đảm bảo âm lượng không vượt quá 1.0

            this.engineSound.setVolume(targetVolume);
            this.engineSound.setPlaybackRate(1.0); // Giữ pitch cố định (mặc định)
        } else {
            // Khi xe dừng, giảm dần âm lượng hoặc dừng hẳn
            if (this.engineSound.isPlaying && this.engineSound.getVolume() > 0.01) { // Giảm ngưỡng dừng
                this.engineSound.setVolume(this.engineSound.getVolume() * 0.95); // Giảm dần âm lượng
            } else if (this.engineSound.isPlaying) {
                this.engineSound.stop();
                this.engineSound.setVolume(baseVolume); // Đặt lại âm lượng về ban đầu khi dừng
            }
        }
    }
}