
// audio player
class Player {

    constructor() {
        this.title_track = null;
        this.music_on = get_cookie("title_music") === "" || get_cookie("title_music") === "on";
        this.music_down = 0; // music key down count frame counter
    }

    play_title_track() {
        if (!this.title_track) {
            this.title_track = new Audio('./resources/the-pearl.mp3');
            this.title_track.loop = true;
            this.title_track.volume = 0.5; // 50%
            this.title_track.addEventListener('ended', function () {
                this.currentTime = 0;
                this.play();
            }, false);
        }
        const startPlaying = () => {
            if (this.music_on) {
                // Browsers return a Promise for .play()
                this.title_track.play().catch(e => console.error("Autoplay blocked:", e));
            }
        };
        if (this.title_track.readyState >= 4) {
            startPlaying();
        } else {
            // 2. Otherwise, wait for the event
            this.title_track.addEventListener('canplaythrough', startPlaying, {once: true});
        }
    }

    stop_title_track() {
        if (this.title_track) {
            this.title_track.pause();
        }
    }

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
