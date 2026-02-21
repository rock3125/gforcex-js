
// audio
let title_track = null;
let music_on = get_cookie("title_music") === "" || get_cookie("title_music") === "on";
let music_down = 0; // music key down count

function play_title_track() {
    if (!title_track) {
        title_track = new Audio('./resources/the-pearl.mp3');
        title_track.loop = true;
        title_track.volume = 0.5; // 50%
        title_track.addEventListener('ended', function() {
            this.currentTime = 0;
            this.play();
        }, false);
    }
    const startPlaying = () => {
        if (music_on) {
            // Browsers return a Promise for .play()
            title_track.play().catch(e => console.error("Autoplay blocked:", e));
        }
    };
    if (title_track.readyState >= 4) {
        startPlaying();
    } else {
        // 2. Otherwise, wait for the event
        title_track.addEventListener('canplaythrough', startPlaying, { once: true });
    }
}

function stop_title_track() {
    if (title_track) {
        title_track.pause();
    }
}

function toggle_music() {
    if (music_on) {
        music_on = false
        set_cookie("title_music", "off", 7)
        if (title_track) title_track.pause();
    } else {
        music_on = true
        set_cookie("title_music", "on", 7)
        if (title_track) title_track.play();
    }
}

// m or M to toggle music
function sound_check_keys() {
    if (keys['KeyM'] && music_down === 0) {
        music_down = 15;
        toggle_music();
    } else if (music_down > 0) {
        music_down -= 1;
    }
}

