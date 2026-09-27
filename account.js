import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig, FIREBASE_CONFIG_READY } from "./firebase-config.js";

const $=id=>document.getElementById(id);
const setup=$("setupWarning"), panel=$("authPanel"), dash=$("dashboardPanel"), status=$("accountStatus");
let auth=null;

function msg(text,type=""){status.textContent=text;status.className="account-status show "+type}
function err(e){const m={"auth/email-already-in-use":"An account already exists with this email address.","auth/invalid-email":"Please enter a valid email address.","auth/weak-password":"Please use a stronger password.","auth/invalid-credential":"The email or password is incorrect.","auth/user-not-found":"No account was found for this email address.","auth/wrong-password":"The email or password is incorrect.","auth/too-many-requests":"Too many attempts. Please wait and try again.","auth/network-request-failed":"Network connection failed. Please try again."};return m[e.code]||"The request could not be completed."}

if(!FIREBASE_CONFIG_READY){setup.classList.add("show")}else{
 const app=initializeApp(firebaseConfig);auth=getAuth(app);
 onAuthStateChanged(auth,user=>{
  if(user){panel.style.display="none";dash.classList.add("show");$("welcomeName").textContent=user.displayName?"Welcome, "+user.displayName:"Welcome";$("welcomeEmail").textContent=user.email||""}
  else{panel.style.display="";dash.classList.remove("show")}
 });
}

$("showSignup").onclick=()=>{$("signupForm").hidden=false;$("signinForm").hidden=true;$("showSignup").classList.add("active");$("showSignin").classList.remove("active");status.className="account-status"};
$("showSignin").onclick=()=>{$("signupForm").hidden=true;$("signinForm").hidden=false;$("showSignup").classList.remove("active");$("showSignin").classList.add("active");status.className="account-status"};

$("signupForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!auth){msg("Firebase is not connected yet. Add the Firebase Web App configuration first.","error");return}
 const name=$("signupName").value.trim(),email=$("signupEmail").value.trim(),password=$("signupPassword").value,confirm=$("signupConfirm").value;
 if(password!==confirm){msg("The passwords do not match.","error");return}
 try{msg("Creating your secure account…");const c=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(c.user,{displayName:name});msg("Account created successfully. You are now signed in.","success")}
 catch(e){msg(err(e),"error")}
});

$("signinForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!auth){msg("Firebase is not connected yet. Add the Firebase Web App configuration first.","error");return}
 try{msg("Signing you in securely…");await signInWithEmailAndPassword(auth,$("signinEmail").value.trim(),$("signinPassword").value);msg("Signed in successfully.","success")}catch(e){msg(err(e),"error")}
});

$("forgotPassword").onclick=async()=>{
 if(!auth){msg("Firebase is not connected yet. Add the Firebase Web App configuration first.","error");return}
 const email=$("signinEmail").value.trim();if(!email){msg("Enter your email address first.","error");return}
 try{await sendPasswordResetEmail(auth,email);msg("Password-reset instructions have been sent to your email.","success")}catch(e){msg(err(e),"error")}
};

$("signoutButton").onclick=async()=>{if(auth){await signOut(auth);msg("You have been signed out.","success")}};
