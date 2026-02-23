
/**
 * Sound / audio player
 */
class Player {
    constructor() {
        this.title_track = null; // the HTML player itself
        // default music on or off?
        this.music_on = get_cookie("title_music") === "" || get_cookie("title_music") === "on";
        this.music_down = 0; // music key down count frame counter

        this.explosionSound = new Audio('./resources/gong.mp3');
        this.explosionSound.volume = 0.7;

        this.firePool = [];
        this.firePoolCurrent = 0;
        for (let i = 0; i < POOL_SIZE; i++) {
            const snd = new Audio('./resources/woodblock.mp3');
            snd.volume = 0.3;
            this.firePool.push(snd);
        }

        this.turretFirePool = [];
        this.turretFirePoolCurrent = 0;
        for (let i = 0; i < POOL_SIZE; i++) {
            const snd = new Audio('./resources/timpany.mp3');
            snd.volume = 0.3;
            this.turretFirePool.push(snd);
        }
    }

    /**
     * start playing music
     */
    play_title_track() {
        // hasn't been set up yet?
        if (!this.title_track) {
            this.title_track = new Audio('./resources/the-pearl.mp3'); // the music track we play
            this.title_track.loop = true; // loop forever
            this.title_track.volume = 0.5; // 50% volume
            // another way of looping
            this.title_track.addEventListener('ended', function () {
                this.title_track.play().catch(e => console.error("Autoplay blocked:", e));
            }, false);
        }
        const startPlaying = () => {
            if (this.music_on) {
                // Browsers return a Promise for .play()
                this.title_track.play().catch(e => console.error("Autoplay blocked:", e));
            }
        };
        // ready to play?
        if (this.title_track.readyState >= 4) {
            startPlaying();
        } else {
            // Otherwise, wait for the event
            this.title_track.addEventListener('canplaythrough', startPlaying, {once: true});
        }
    }

    /**
     * pause the music track
     */
    stop_title_track() {
        if (this.title_track) {
            this.title_track.pause();
        }
    }

    /**
     * something explodes
     */
    play_explosion() {
        // Play the sound
        this.explosionSound.currentTime = 0;
        // Slightly randomize pitch so every death sounds different
        this.explosionSound.playbackRate = 0.8 + Math.random() * 0.4;
        this.explosionSound.play().catch(e => {});
    }

    /**
     * player shoots
     */
    play_shoot() {
        const snd = this.firePool[this.firePoolCurrent];
        snd.currentTime = 0; // Reset to start
        snd.play().catch(e => {});
        this.firePoolCurrent = (this.firePoolCurrent + 1) % POOL_SIZE;
    }

    /**
     * a turret shoots
     */
    turret_shoot() {
        const snd = this.turretFirePool[this.turretFirePoolCurrent];
        snd.currentTime = 0; // Reset to start
        snd.play().catch(e => {});
        this.turretFirePoolCurrent = (this.turretFirePoolCurrent + 1) % POOL_SIZE;
    }

    /**
     * toggle music on / off
     */
    toggle_music() {
        if (this.music_on) {
            this.music_on = false
            set_cookie("title_music", "off", 7)
            if (this.title_track) this.title_track.pause();
        } else {
            this.music_on = true
            set_cookie("title_music", "on", 7)
            if (this.title_track) this.title_track.play();
        }
    }

    // m or M to toggle music
    sound_check_keys(keys) {
        if (keys['KeyM'] && this.music_down === 0) {
            this.music_down = 15;
            this.toggle_music();
        } else if (this.music_down > 0) {
            this.music_down -= 1;
        }
    }

}

