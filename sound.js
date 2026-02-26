
/**
 * Sound / audio player
 */
class Player {
    constructor() {
        this.title_track = null; // the HTML player itself
        // default music on or off?
        this.music_on = get_cookie("title_music") === "" || get_cookie("title_music") === "on";
        this.music_down = 0; // music key down count frame counter

        // exploding things make this sound (turrets and player)
        this.explosionSound = new Audio('./resources/gong.mp3');
        this.explosionSound.volume = 0.7;

        // player's engine sound
        this.thrustSound = new Audio('./resources/drone.mp3');
        this.thrustSound.volume = 0.2;
        this.thrustSound.loop = true;

        // landing sound
        this.landSound = new Audio('./resources/pizzicato.mp3');
        this.landSound.volume = 0.2;

        // sound for collecting an orb
        this.orbSound = new Audio('./resources/glissando.mp3');
        this.orbSound.volume = 0.2;

        // we have a set of POOL_SIZE items for firing multiple projectiles
        this.firePool = [];
        this.firePoolCurrent = 0;
        for (let i = 0; i < POOL_SIZE; i++) {
            const snd = new Audio('./resources/woodblock.mp3');
            snd.volume = 0.3;
            this.firePool.push(snd);
        }

        // we have a set of POOL_SIZE items for firing multiple projectiles for turrets
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
            // another way of looping - just in case loop above doesn't work
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
     * something explodes
     */
    play_explosion() {
        // Play the sound, starting from the beginning of the track
        this.explosionSound.currentTime = 0;
        // slightly randomize pitch so every death sounds different
        this.explosionSound.playbackRate = 0.8 + Math.random() * 0.4;
        this.explosionSound.play().catch(e => {});
    }

    /**
     * player shoots
     */
    play_shoot() {
        // grab the next soundtrack
        const snd = this.firePool[this.firePoolCurrent];
        snd.currentTime = 0; // reset to start of soundtrack
        snd.play().catch(e => {});
        // next slot
        this.firePoolCurrent = (this.firePoolCurrent + 1) % POOL_SIZE;
    }

    /**
     * a turret shoots
     */
    turret_shoot() {
        // grab the next soundtrack
        const snd = this.turretFirePool[this.turretFirePoolCurrent];
        snd.currentTime = 0; // reset to start
        snd.play().catch(e => {});
        // next slot
        this.turretFirePoolCurrent = (this.turretFirePoolCurrent + 1) % POOL_SIZE;
    }

    /**
     * play thruster sound
     * @param vx speed in x direction
     * @param vy speed in y direction
     */
    thrust_down(vx, vy) {
        // paused? -> just play it
        if (this.thrustSound.paused) {
            this.thrustSound.play().catch(e => {});
        }
        // Make the engine sound higher pitched as we go faster
        const speed = Math.sqrt(vx * vx + vy * vy);
        this.thrustSound.playbackRate = 1.0 + (speed * 0.05);
    }

    /**
     * stop the ship's thruster
     */
    thrust_stop() {
        // reset sound for ship thrust
        if (!this.thrustSound.paused) {
            this.thrustSound.pause();
            this.thrustSound.currentTime = 0;
        }
    }

    /**
     * the ship lands
     */
    land() {
        // play landing sound
        this.landSound.currentTime = 0;
        this.landSound.play().catch(e => {});
    }

    /**
     * a user collects an orb
     */
    collect_orb() {
        // play orb collection sound
        this.orbSound.currentTime = 0;
        this.orbSound.play().catch(e => {});
    }

    /**
     * toggle music on / off
     */
    toggle_music() {
        if (this.music_on) {
            // toggle off
            this.music_on = false
            set_cookie("title_music", "off", 7) // set global state
            if (this.title_track) this.title_track.pause();
        } else {
            // start playing
            this.music_on = true
            set_cookie("title_music", "on", 7) // set global state
            if (this.title_track) this.title_track.play();
        }
    }

    // m or M to toggle music
    sound_check_keys(keys) {
        if (keys['KeyM'] && this.music_down === 0) {
            this.music_down = 15; // frame delay - because the keyboard is a game keyboard
            this.toggle_music();
        } else if (this.music_down > 0) {
            this.music_down -= 1;
        }
    }

}

