let token=localStorage.getItem("love_token"), user=null, socket=null, pc=null, localStream=null, isCaller=false, callMode="video";
const $=id=>document.getElementById(id);
let registerMode=false;

$("loginTab").onclick=()=>{registerMode=false;setAuthMode()};
$("registerTab").onclick=()=>{registerMode=true;setAuthMode()};
function setAuthMode(){
  $("loginTab").classList.toggle("active",!registerMode); $("registerTab").classList.toggle("active",registerMode);
  $("invite").style.display=registerMode?"block":"none"; $("authBtn").textContent=registerMode?"Create our private chat ❤️":"Enter our chat ❤️";
}
$("authForm").onsubmit=async e=>{
  e.preventDefault(); $("authError").textContent="";
  const body={username:$("username").value.trim(),password:$("password").value};
  if(registerMode) body.invite=$("invite").value.trim();
  const r=await fetch(registerMode?"/api/register":"/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d=await r.json(); if(!r.ok){$("authError").textContent=d.error||"Something went wrong";return}
  token=d.token;localStorage.setItem("love_token",token);start(d.user);
};
$("logout").onclick=()=>{localStorage.removeItem("love_token");location.reload()};

async function boot(){
 if(!token)return;
 const r=await fetch("/api/me",{headers:{Authorization:"Bearer "+token}});
 if(!r.ok){localStorage.removeItem("love_token");return}
 const d=await r.json();start(d.user);
}
async function start(u){
 user=u;$("auth").classList.add("hidden");$("app").classList.remove("hidden");$("me").textContent=u.username;$("status").textContent="Online";
 const r=await fetch("/api/messages",{headers:{Authorization:"Bearer "+token}});
 if(r.ok)(await r.json()).forEach(addMessage);
 socket=io({auth:{token}});
 socket.on("connect",()=>{$("partnerStatus").textContent="Online / ready";});
 socket.on("presence",p=>{if(p.username!==user.username){$("partnerStatus").textContent=p.online?"Online":"Offline";}});
 socket.on("message",addMessage);
 socket.on("call:offer",async d=>{ if(pc) return; callMode="video"; $("callTitle").textContent=d.from+" is calling ❤️"; $("callHint").textContent="Accepting call…"; await showCall(true); await createPeer(false); await pc.setRemoteDescription(d.offer); const ans=await pc.createAnswer();await pc.setLocalDescription(ans);socket.emit("call:answer",{answer:pc.localDescription});});
 socket.on("call:answer",async d=>{if(pc) await pc.setRemoteDescription(d.answer)});
 socket.on("call:ice",async d=>{if(pc&&d.candidate) try{await pc.addIceCandidate(d.candidate)}catch{}});
 socket.on("call:end",cleanupCall);
}
function addMessage(m){
 const el=document.createElement("div");el.className="bubble "+(m.username===user?.username?"mine":"");
 el.textContent=m.text;const small=document.createElement("small");small.textContent=new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});el.appendChild(small);
 $("messages").appendChild(el);$("messages").scrollTop=$("messages").scrollHeight;
}
$("sendForm").onsubmit=e=>{e.preventDefault();const text=$("messageInput").value.trim();if(text&&socket){socket.emit("message",{text});$("messageInput").value=""}};
$("voiceBtn").onclick=()=>startCall("voice");$("videoBtn").onclick=()=>startCall("video");$("endCall").onclick=()=>{socket?.emit("call:end");cleanupCall()};

async function startCall(mode){
 callMode=mode;$("callTitle").textContent=mode==="video"?"Video call ❤️":"Voice call ❤️";$("callHint").textContent="Calling your love…";await showCall(mode==="video");await createPeer(true);
 const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit("call:offer",{offer:pc.localDescription});
}
async function showCall(video){
 $("call").classList.remove("hidden");$("localVideo").style.display=video?"block":"none";$("remoteVideo").style.display=video?"block":"none";
 try{
  localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:video});
  $("localVideo").srcObject=localStream;
 }catch(e){$("callHint").textContent="Camera/microphone permission is required.";throw e}
}
async function createPeer(caller){
 pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
 localStream?.getTracks().forEach(t=>pc.addTrack(t,localStream));
 pc.onicecandidate=e=>{if(e.candidate)socket.emit("call:ice",{candidate:e.candidate})};
 pc.ontrack=e=>{$("remoteVideo").srcObject=e.streams[0];$("callHint").textContent="Connected ❤️"};
}
function cleanupCall(){
 pc?.close();pc=null;localStream?.getTracks().forEach(t=>t.stop());localStream=null;$("call").classList.add("hidden");$("remoteVideo").srcObject=null;$("localVideo").srcObject=null;
}
boot();
