
function get_cookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function set_cookie(cname, cvalue, ex_days, text_display_ctrl) {
    const d = new Date();
    d.setTime(d.getTime() + (ex_days*24*60*60*1000));
    let expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";

    if (cname === "title_music" && text_display_ctrl && text_display_ctrl.textContent) {
        if (cvalue === "on") {
            document.getElementById("music").textContent = "Music on"
        } else {
            document.getElementById("music").textContent = "Music off"
        }
    }
}

