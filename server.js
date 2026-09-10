require("dotenv").config?.();
const express = require("express");
const http = require("http");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_IN_PRODUCTION";
const INVITE = process.env.COUPLE_INVITE_CODE || "LOVE2026";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const db = new Database("lovechat.db");

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  text TEXT,
  type TEXT DEFAULT 'text',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

function tokenFor(user){ return jwt.sign({id:user.id, username:user.username}, JWT_SECRET, {expiresIn:"30d"}); }
function auth(req,res,next){
  try {
    const h=req.headers.authorization||"";
    req.user=jwt.verify(h.startsWith("Bearer ")?h.slice(7):"",JWT_SECRET);
    next();
  } catch { res.status(401).json({error:"Please log in again."}); }
}

app.post("/api/register", async (req,res)=>{
  const {username,password,invite}=req.body||{};
  if(invite!==INVITE) return res.status(403).json({error:"Invalid private couple invite code."});
  if(!/^[a-zA-Z0-9_]{3,24}$/.test(username||"")) return res.status(400).json({error:"Username must be 3–24 letters, numbers or underscore."});
  if((password||"").length<8) return res.status(400).json({error:"Password must be at least 8 characters."});
  try {
    const hash=await bcrypt.hash(password,12);
    const info=db.prepare("INSERT INTO users(username,password_hash) VALUES(?,?)").run(username,hash);
    const user={id:info.lastInsertRowid,username};
    res.json({token:tokenFor(user),user});
  } catch { res.status(409).json({error:"That username is already taken."}); }
});

app.post("/api/login", async (req,res)=>{
  const row=db.prepare("SELECT * FROM users WHERE username=?").get(req.body?.username||"");
  if(!row || !(await bcrypt.compare(req.body?.password||"",row.password_hash)))
    return res.status(401).json({error:"Wrong username or password."});
  const user={id:row.id,username:row.username};
  res.json({token:tokenFor(user),user});
});

app.get("/api/me",auth,(req,res)=>res.json({user:{id:req.user.id,username:req.user.username}}));

app.get("/api/messages",auth,(req,res)=>{
  const rows=db.prepare(`
    SELECT m.id,m.text,m.type,m.created_at,u.username
    FROM messages m JOIN users u ON u.id=m.user_id
    ORDER BY m.id DESC LIMIT 100
  `).all().reverse();
  res.json(rows);
});

io.use((socket,next)=>{
  try {
    const t=socket.handshake.auth?.token;
    socket.user=jwt.verify(t,JWT_SECRET);
    next();
  } catch { next(new Error("Unauthorized")); }
});

io.on("connection",socket=>{
  socket.join("couple");
  socket.emit("presence",{username:socket.user.username,online:true});
  socket.broadcast.to("couple").emit("presence",{username:socket.user.username,online:true});

  socket.on("message",data=>{
    const text=String(data?.text||"").trim().slice(0,2000);
    if(!text) return;
    const info=db.prepare("INSERT INTO messages(user_id,text,type) VALUES(?,?,?)").run(socket.user.id,text,"text");
    const msg={id:info.lastInsertRowid,text,type:"text",created_at:new Date().toISOString(),username:socket.user.username};
    io.to("couple").emit("message",msg);
  });

  // WebRTC signaling: offer/answer/ICE candidates never get stored.
  socket.on("call:offer",data=>socket.broadcast.to("couple").emit("call:offer",{from:socket.user.username,offer:data.offer}));
  socket.on("call:answer",data=>socket.broadcast.to("couple").emit("call:answer",{from:socket.user.username,answer:data.answer}));
  socket.on("call:ice",data=>socket.broadcast.to("couple").emit("call:ice",{from:socket.user.username,candidate:data.candidate}));
  socket.on("call:end",()=>socket.broadcast.to("couple").emit("call:end"));
  socket.on("disconnect",()=>socket.broadcast.to("couple").emit("presence",{username:socket.user.username,online:false}));
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
server.listen(PORT,()=>console.log(`LoveChat running at http://localhost:${PORT}`));
