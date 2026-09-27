import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = id => document.getElementById(id);
const panel = $("authPanel");
const dash = $("dashboardPanel");
const status = $("accountStatus");
const setup = $("setupWarning");
const resetPanel = $("passwordResetPanel");
let recoveryMode = false;

function msg(text, type = "") {
  status.textContent = text;
  status.className = "account-status show " + type;
}

function err(e) {
  const message = String(e?.message || "").toLowerCase();
  if (message.includes("user already registered")) return "An account already exists with this email address.";
  if (message.includes("invalid login credentials")) return "The email or password is incorrect.";
  if (message.includes("password should be at least")) return "Please use a stronger password.";
  if (message.includes("unable to validate email address")) return "Please enter a valid email address.";
  if (message.includes("rate limit")) return "Too many requests. Please wait a little and try again.";
  if (message.includes("email not confirmed")) return "Please confirm your email address before signing in.";
  if (message.includes("network")) return "Network connection failed. Please try again.";
  return e?.message || "The request could not be completed.";
}

function showSignedIn(user) {
  panel.style.display = "none";
  resetPanel.hidden = true;
  dash.classList.add("show");
  $("welcomeName").textContent = user?.user_metadata?.full_name
    ? "Welcome, " + user.user_metadata.full_name
    : "Welcome";
  $("welcomeEmail").textContent = user?.email || "";
}

function showSignedOut() {
  panel.style.display = "";
  dash.classList.remove("show");
}

function showRecoveryMode() {
  recoveryMode = true;
  panel.style.display = "";
  dash.classList.remove("show");
  resetPanel.hidden = false;
  $("signinForm").hidden = true;
  $("signupForm").hidden = true;
  document.querySelector(".account-tabs").style.display = "none";
  msg("Enter a new password for your TW&D account.");
}

$("showSignup").onclick = () => {
  $("signupForm").hidden = false;
  $("signinForm").hidden = true;
  $("showSignup").classList.add("active");
  $("showSignin").classList.remove("active");
  status.className = "account-status";
};

$("showSignin").onclick = () => {
  $("signupForm").hidden = true;
  $("signinForm").hidden = false;
  $("showSignup").classList.remove("active");
  $("showSignin").classList.add("active");
  status.className = "account-status";
};

$("signupForm").addEventListener("submit", async e => {
  e.preventDefault();

  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const phone = $("signupPhone").value.trim();
  const password = $("signupPassword").value;
  const confirm = $("signupConfirm").value;

  if (password !== confirm) {
    msg("The passwords do not match.", "error");
    return;
  }

  try {
    msg("Creating your secure account…");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/account.html",
        data: {
          full_name: name,
          phone: phone
        }
      }
    });

    if (error) throw error;

    if (data.session) {
      msg("Account created successfully. You are now signed in.", "success");
    } else {
      msg("Account created. Please check your email and confirm your address before signing in.", "success");
      $("signupForm").reset();
      $("showSignin").click();
      $("signinEmail").value = email;
    }
  } catch (e) {
    msg(err(e), "error");
  }
});

$("signinForm").addEventListener("submit", async e => {
  e.preventDefault();

  try {
    msg("Signing you in securely…");
    const { error } = await supabase.auth.signInWithPassword({
      email: $("signinEmail").value.trim(),
      password: $("signinPassword").value
    });

    if (error) throw error;
    msg("Signed in successfully.", "success");
  } catch (e) {
    msg(err(e), "error");
  }
});

$("forgotPassword").onclick = async () => {
  const email = $("signinEmail").value.trim();

  if (!email) {
    msg("Enter your email address first.", "error");
    return;
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/account.html"
    });

    if (error) throw error;
    msg("Password-reset instructions have been sent to your email.", "success");
  } catch (e) {
    msg(err(e), "error");
  }
};

$("passwordResetForm").addEventListener("submit", async e => {
  e.preventDefault();

  const password = $("newPassword").value;
  const confirm = $("newPasswordConfirm").value;

  if (password !== confirm) {
    msg("The passwords do not match.", "error");
    return;
  }

  try {
    msg("Updating your password…");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;

    recoveryMode = false;
    resetPanel.hidden = true;
    $("signinForm").hidden = false;
    document.querySelector(".account-tabs").style.display = "";
    msg("Your password has been updated. You can now sign in.", "success");
    await supabase.auth.signOut();
  } catch (e) {
    msg(err(e), "error");
  }
});

$("signoutButton").onclick = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) msg(err(error), "error");
  else msg("You have been signed out.", "success");
};

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    showRecoveryMode();
    return;
  }

  if (session?.user && !recoveryMode) {
    showSignedIn(session.user);
  } else if (!recoveryMode) {
    showSignedOut();
  }
});

(async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session && !recoveryMode) showSignedIn(data.session.user);
  } catch (e) {
    setup.classList.add("show");
    msg("The account service could not be reached. Please try again later.", "error");
  }
})();