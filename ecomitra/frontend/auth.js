import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
    GoogleAuthProvider,
    browserLocalPersistence,
    browserSessionPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    sendPasswordResetEmail,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBC0b8JpGcQrA2-G2yEHjKdxc2eMAj7A-k",
    authDomain: "ecomitra-24173.firebaseapp.com",
    projectId: "ecomitra-24173",
    storageBucket: "ecomitra-24173.firebasestorage.app",
    messagingSenderId: "847837571169",
    appId: "1:847837571169:web:f7cac46cb5477d87e26220",
    measurementId: "G-SYBZJQY9YB",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const pageMode = document.body.dataset.authMode || "public";
const logoutRedirectKey = "eco-mitra-post-logout";

function sanitizeNextPath(value) {
    if (!value) {
        return "index.html#upload";
    }

    try {
        const candidate = new URL(value, window.location.origin);
        if (candidate.origin !== window.location.origin) {
            return "index.html";
        }

        const relative = `${candidate.pathname.split("/").pop() || "index.html"}${candidate.search}${candidate.hash}`;
        return relative || "index.html";
    } catch {
        return "index.html";
    }
}

function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    return sanitizeNextPath(params.get("next"));
}

function getCurrentPage() {
    return window.location.pathname.split("/").pop() || "home.html";
}

function persistUserSnapshot(user) {
    if (!user) {
        localStorage.removeItem("user");
        return;
    }

    localStorage.setItem(
        "user",
        JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || "",
            photoURL: user.photoURL || "",
        }),
    );
}

function showMessage(message, type = "error") {
    const errorBox = document.getElementById("error-message");
    const successBox = document.getElementById("success-message");

    if (errorBox) {
        errorBox.textContent = "";
        errorBox.classList.remove("show");
    }

    if (successBox) {
        successBox.textContent = "";
        successBox.classList.remove("show");
    }

    const target = type === "success" ? successBox : errorBox;
    if (!target) {
        if (message) {
            window.alert(message);
        }
        return;
    }

    target.textContent = message;
    target.classList.add("show");
}

function getFriendlyAuthError(error) {
    switch (error.code) {
        case "auth/operation-not-allowed":
            return "This sign-in method is not enabled in Firebase yet. Enable Email/Password and Google in Firebase Console > Authentication > Sign-in method.";
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
            return "The email or password is incorrect.";
        case "auth/email-already-in-use":
            return "An account with this email already exists.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/weak-password":
            return "Use a stronger password with at least 6 characters.";
        case "auth/popup-closed-by-user":
            return "Google sign-in was closed before completion.";
        case "auth/popup-blocked":
            return "Your browser blocked the Google sign-in popup. Allow popups and try again.";
        case "auth/too-many-requests":
            return "Too many attempts were made. Please wait a moment and try again.";
        default:
            return error.message || "Authentication failed. Please try again.";
    }
}

function setButtonState(button, html, disabled) {
    if (!button) {
        return;
    }

    button.innerHTML = html;
    button.disabled = disabled;
}

function revealPage(user) {
    document.body.hidden = false;
    window.dispatchEvent(new CustomEvent("eco-auth-ready", { detail: { user } }));
}

function updateHomePage(user) {
    const getStartedBtn = document.getElementById("get-started-btn");
    const subtitle = document.getElementById("home-auth-copy");

    if (!getStartedBtn || !subtitle || getCurrentPage() !== "home.html") {
        return;
    }

    if (user) {
        getStartedBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Open Dashboard';
        getStartedBtn.onclick = () => {
            window.location.href = "index.html#upload";
        };
        if (subtitle) {
            subtitle.textContent = `Signed in as ${user.displayName || user.email}. Continue your sustainability journey.`;
        }
        return;
    }

    getStartedBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Get Started';
    getStartedBtn.onclick = () => {
        window.location.href = "login.html";
    };
    if (subtitle) {
        subtitle.textContent = "Your AI-powered companion for sustainable living";
    }
}

function bindLogoutButtons() {
    const buttons = document.querySelectorAll("#logout-btn, [data-auth-action='logout']");
    buttons.forEach((button) => {
        if (button.dataset.authBound === "true") {
            return;
        }

        button.dataset.authBound = "true";
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            try {
                sessionStorage.setItem(logoutRedirectKey, "home.html");
                await signOut(auth);
                window.location.replace("home.html");
            } catch (error) {
                sessionStorage.removeItem(logoutRedirectKey);
                showMessage(getFriendlyAuthError(error));
            }
        });
    });
}

async function handleLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitBtn = form.querySelector("button[type='submit']");
    const rememberMe = form.querySelector("input[name='remember']");
    const originalHtml = submitBtn.innerHTML;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    setButtonState(submitBtn, '<i class="fas fa-spinner fa-spin"></i> Signing in...', true);
    showMessage("");

    try {
        await setPersistence(
            auth,
            rememberMe?.checked ? browserLocalPersistence : browserSessionPersistence,
        );
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = getRedirectTarget();
    } catch (error) {
        showMessage(getFriendlyAuthError(error));
        setButtonState(submitBtn, originalHtml, false);
    }
}

async function handleRegister(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitBtn = form.querySelector("button[type='submit']");
    const originalHtml = submitBtn.innerHTML;
    const fullName = document.getElementById("fullname").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;

    showMessage("");

    if (password !== confirmPassword) {
        showMessage("Passwords do not match.");
        return;
    }

    setButtonState(submitBtn, '<i class="fas fa-spinner fa-spin"></i> Creating account...', true);

    try {
        await setPersistence(auth, browserLocalPersistence);
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (fullName) {
            await updateProfile(credential.user, { displayName: fullName });
        }
        window.location.href = "index.html#upload";
    } catch (error) {
        showMessage(getFriendlyAuthError(error));
        setButtonState(submitBtn, originalHtml, false);
    }
}

async function handleGoogleAuth(button) {
    const originalHtml = button.innerHTML;
    showMessage("");
    setButtonState(button, '<i class="fas fa-spinner fa-spin"></i> Connecting to Google...', true);

    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, googleProvider);
        window.location.href = getRedirectTarget();
    } catch (error) {
        showMessage(getFriendlyAuthError(error));
        setButtonState(button, originalHtml, false);
    }
}

async function handlePasswordReset(event) {
    event.preventDefault();
    const email = document.getElementById("email")?.value.trim();

    if (!email) {
        showMessage("Enter your email address first, then click Forgot Password again.");
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        showMessage("Password reset email sent. Check your inbox.", "success");
    } catch (error) {
        showMessage(getFriendlyAuthError(error));
    }
}

function bindForms() {
    const loginForm = document.getElementById("login-form");
    if (loginForm && loginForm.dataset.authBound !== "true") {
        loginForm.dataset.authBound = "true";
        loginForm.addEventListener("submit", handleLogin);
    }

    const registerForm = document.getElementById("register-form");
    if (registerForm && registerForm.dataset.authBound !== "true") {
        registerForm.dataset.authBound = "true";
        registerForm.addEventListener("submit", handleRegister);
    }

    const googleButton = document.getElementById("google-signin-btn");
    if (googleButton && googleButton.dataset.authBound !== "true") {
        googleButton.dataset.authBound = "true";
        googleButton.addEventListener("click", () => handleGoogleAuth(googleButton));
    }

    const forgotPassword = document.querySelector(".forgot-password");
    if (forgotPassword && forgotPassword.dataset.authBound !== "true") {
        forgotPassword.dataset.authBound = "true";
        forgotPassword.addEventListener("click", handlePasswordReset);
    }
}

bindForms();
bindLogoutButtons();

onAuthStateChanged(auth, (user) => {
    persistUserSnapshot(user);
    updateHomePage(user);
    bindLogoutButtons();

    const pendingLogoutRedirect = sessionStorage.getItem(logoutRedirectKey);
    if (!user && pendingLogoutRedirect) {
        sessionStorage.removeItem(logoutRedirectKey);
        window.location.replace(pendingLogoutRedirect);
        return;
    }

    if (pageMode === "guest" && user) {
        window.location.replace(getRedirectTarget());
        return;
    }

    if (pageMode === "protected" && !user) {
        const next = encodeURIComponent(getCurrentPage());
        window.location.replace(`login.html?next=${next}`);
        return;
    }

    revealPage(user);
});
