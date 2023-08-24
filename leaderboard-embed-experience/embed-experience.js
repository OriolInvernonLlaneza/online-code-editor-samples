import firebase from './firebase.js';

let studioFrame;

const experienceUrl = "https://studio.onirix.com/projects/8721b3088abb44ea83f87dd972e3b3b5/webar?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMjgwLCJwcm9qZWN0SWQiOjUyNDA1LCJyb2xlIjozLCJpYXQiOjE2OTI3MDUxMDF9.7OgQHOLBUGpnqHdMo_j29C2-okgyDqgWlQHSK13Qpl0&background=alpha&preview=false&hide_controls=false&ar_button=false";
const firebaseController = new firebase.FirebaseController();
let userData;
let userCredential;

/**
 * Create the iframe that will link the experience
 * onload send a message with user's data.
 */
function loadExperience() {
    studioFrame = document.getElementById("oex-frame")
    if (null == studioFrame) {
        studioFrame = document.createElement('iframe');
        studioFrame.id = "studioFrame";
        studioFrame.allow = "autoplay;camera;gyroscope;accelerometer;magnetometer;fullscreen;xr-spatial-tracking;geolocation;";
        document.body.appendChild(studioFrame);
    }
    studioFrame.src = experienceUrl;
    main.classList.add("oex-hide");
}

/**
 * Check if there is already a logged user
 * If there is, retrieve its data and go to the experience.
 * If there isn't go to register.
 */
function checkCredentials() {
    userCredential = JSON.parse(localStorage.getItem("oex-user"));
    if (userCredential) {
        getUserData().then(() => loadExperience());
    } else {
        landing.classList.add('oex-hide');
        registerForm.classList.remove('oex-hide');
        registerButton.onclick = register;
        loginButton.onclick = login;
    }
}

/**
 * 
 */
function register() {
    const form = document.querySelector('.oex-register-form form');
    if (form.checkValidity() === true) {
        const user = {
            email: document.getElementById('oex-email').value,
            name: document.getElementById('oex-name').value,
            nickname: document.getElementById('oex-nickname').value,
            password: document.getElementById('oex-password').value,
            newsletter: document.getElementById('oex-newsletter').value
        }

        try {
            registerForm.removeChild(erMsg);
        } catch (e) { }

        registerButton.setAttribute('disabled', true);
        firebaseController.register(user.email, user.password).then(async credentials => {
            setUserCredentials(credentials.user)

            userData = user;
            delete userData.password;
            userData.score = 0;
            userData.uuid = userCredential.uid;

            await insertUserData();
            loadExperience();
            registerButton.removeAttribute('disabled');
        }).catch(err => {
            console.error(err);
            erMsg.textContent = err.code === "auth/email-already-in-use" ?
                "The provided email is already in use" : "An error ocurred. Please, try again later";
            form.appendChild(erMsg);
            registerButton.removeAttribute('disabled');
        });
    } else {
        form.classList.add('oex-submitted');
    }
}

/**
 * 
 */
function login() {
    const form = document.querySelector('.oex-login-form form');
    if (form.checkValidity() === true) {
        const user = {
            email: document.getElementById('oex-login-email').value,
            password: document.getElementById('oex-login-password').value
        }

        try {
            loginForm.removeChild(erMsg);
        } catch (e) { }

        loginButton.setAttribute('disabled', true);
        firebaseController.login(user.email, user.password).then(async credentials => {
            setUserCredentials(credentials.user)
            userData = await getUserData();
            loadExperience();
            loginButton.removeAttribute('disabled');
        }).catch(err => {
            console.error(err);
            erMsg.textContent = err.code === "auth/user-not-found" ?
                "No user registered with the given email" : "An error ocurred. Please, try again later";
            form.appendChild(erMsg);
            loginButton.removeAttribute('disabled');
        });
    } else {
        form.classList.add('oex-submitted');
    }
}

/**
 * Calls firebase to retrieve the user
 * @returns UserData
 */
async function getUserData() {
    userData = await firebaseController.getUser(userCredential.uid);
    return userData;
}

/**
 * Inserts the user in firebase
 * @returns
 */
async function insertUserData() {
    return await firebaseController.insertUser(userData);
}

/**
 * Process the end of game message from the experience.
 * Navigate to the leaderboard when processed.
 * @param {*} event containing the new score
 */
function processMessage(event) {
    if (event.origin != "https://studio.onirix.com") {
        return;
    }

    if (event.data != null && event.data.score != null) {
        if (!userData.score || userData.score < event.data.score) {
            userData.score = event.data.score;
            firebaseController.updateUser(userData).then(() => getLeaderboard().then());
        } else {
            getLeaderboard().then();
        }
    } else {
        // First communication comes from the experience after it loads
        // When loaded, send the user's data.
        studioFrame.contentWindow.postMessage({
            leaderboardEvent: 'sendUserData',
            userData: JSON.stringify(userData)
        }, "*");
    }
}

async function getLeaderboard() {
    // UI
    main.classList.remove('oex-hide');
    registerForm.classList.add('oex-hide');
    loginForm.classList.add('oex-hide');
    landing.classList.add('oex-hide');
    studioFrame.classList.add('oex-hide');
    leaderboard.classList.remove('oex-hide');
    const list = document.querySelector('.oex-leaderboard__list')
    const ul = document.createElement('ul');

    // getData
    const users = await firebaseController.getAllUsers();
    let lastScore = Number.MAX_SAFE_INTEGER;
    let lastIndex = 1;
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const li = document.createElement('li');

        const num = document.createElement('span');
        const name = document.createElement('span');
        const score = document.createElement('span');

        if (Math.trunc(user.score) !== lastScore) {
            lastScore = Math.trunc(user.score);
            lastIndex = i + 1;
        }

        num.textContent = lastIndex + 'º';
        name.textContent = user.nickname;
        score.textContent = lastScore;

        if (user.email === userData.email) {
            const span = document.createElement("span");;
            span.innerHTML = userSVG.trim();
            li.classList.add('oex-currentuser');
            li.append(num, name, span.firstChild, score);
        } else {
            li.append(num, name, score);
        }

        ul.appendChild(li);
    }

    list.appendChild(ul);

    document.getElementById('oex-playagain').onclick = () => {
        list.innerHTML = "";
        loadExperience();
    }
}

function setUserCredentials(credentials) {
    localStorage.setItem('oex-user', JSON.stringify(credentials));
    userCredential = credentials;
}

function toggleForms() {
    registerForm.classList.toggle('oex-hide');
    loginForm.classList.toggle('oex-hide');
}

window.addEventListener("message", (ev) => processMessage(ev));

const main = document.getElementById("oex-main");
const leaderboard = document.querySelector(".oex-leaderboard");
const landing = document.getElementById('oex-landing');
const registerForm = document.querySelector('.oex-register-form');
const loginForm = document.querySelector('.oex-login-form');
const registerButton = document.getElementById('oex-register');
const loginButton = document.getElementById('oex-login');
const erMsg = document.createElement('p');
erMsg.classList.add('oex-error');
document.getElementById('oex-gotoregister').onclick = toggleForms;
document.getElementById('oex-gotologin').onclick = toggleForms;

document.getElementById('oex-play').onclick = checkCredentials;

const userSVG = `<svg width="10" height="12" viewBox="0 0 10 12" xmlns="http://www.w3.org/2000/svg"><g fill="#580088" fill-rule="evenodd"><path d="M5.055 5.928c1.584 0 2.872-1.33 2.872-2.964S6.64 0 5.055 0C3.47 0 2.182 1.33 2.182 2.964c0 1.635 1.289 2.964 2.873 2.964M5 6.24c-2.757 0-5 2.315-5 5.16 0 .331.26.6.582.6h8.836a.591.591 0 0 0 .582-.6c0-2.845-2.243-5.16-5-5.16"/></g></svg>`;