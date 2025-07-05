// const authRoutes = require("./routes/auth.routes.js")
// const messageRoutes = require("./routes/message.route.js")
const stream = require('stream');
const cloudinary = require("./lib/cloudinary.js");
// const { getReceiverSocketId, io } = require("./lib/socket.js");
const { Readable } = require('stream');
// socket-server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require("mongoose");
require('dotenv').config();
const bodyParser = require("body-parser");
const app = express();
const server = http.createServer(app);
const cors = require("cors");
const nodemailer = require('nodemailer'); // Import Nodemailer
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');




// Return socket ID of receiver
const getReceiverSocketId = (userId) => {
  return userSocketMap[userId];
};


const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const userSocketMap = {};
const typingUsers = new Set();

// io.on('connection', (socket) => {
//   const { userId } = socket.handshake.query;

//   if (userId) userSocketMap[userId] = socket.id;
//   io.emit('getOnlineUsers', Object.keys(userSocketMap));

//   socket.on('userTyping', ({ userId }) => {
//     typingUsers.add(userId);

//     socket.broadcast.emit('typingUsers', Array.from(typingUsers)); // not to self
//   });

//   socket.on('userStopTyping', ({ userId }) => {
//     typingUsers.delete(userId);
//     socket.broadcast.emit('typingUsers', Array.from(typingUsers));
//   });

//   socket.on('disconnect', () => {
//     console.log('discccccccccc');
    
//     delete userSocketMap[userId];
//     typingUsers.delete(userId);
//     io.emit('getOnlineUsers', Object.keys(userSocketMap));
//     socket.broadcast.emit('typingUsers', Array.from(typingUsers));
//   });
// });


io.on('connection', (socket) => {
  const { userId } = socket.handshake.query;

  // Track connected user
  if (userId) {
      userSocketMap[userId] = socket.id;
      // console.log(`User ${userId} connected as socket ${socket.id}`);
  }

  // Update all clients with online users
  updateOnlineUsers();

  // Typing indicators
  socket.on('userTyping', ({ userId }) => {
      typingUsers.add(userId);
      broadcastTypingUsers();
  });

  socket.on('userStopTyping', ({ userId }) => {
      typingUsers.delete(userId);
      broadcastTypingUsers();
  });

  // Handle disconnection
  socket.on('disconnect', () => {
      // console.log(`User ${userId} disconnected (socket ${socket.id})`);
      
      if (userId) {
          delete userSocketMap[userId];
          typingUsers.delete(userId);
          updateOnlineUsers();
          broadcastTypingUsers();
      }
  });

  // Helper functions
  function updateOnlineUsers() {
      io.emit('getOnlineUsers', Object.keys(userSocketMap));
  }

  function broadcastTypingUsers() {
      socket.broadcast.emit('typingUsers', Array.from(typingUsers));
  }
});


// STORE ONLINE USERS
const clients = {};

// Initialize Google OAuth Client
const gooClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


app.use(bodyParser.urlencoded({ limit: '10mb' , extended: true }));
app.use(bodyParser.json({ limit: '10mb' }));

app.use(cors());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) return callback(null, true);

    // You can also validate origin dynamically if needed
    callback(null, true); // Allow all for now
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// MongoDB connection string
const mongoURI = 'mongodb+srv://nizamvtpmna:863400@cluster0.2cg9yoq.mongodb.net/Portfolio?retryWrites=true&w=majority';

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => { })
  .catch(err => console.error('MongoDB connection error:', err));

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    voice: {
      type: String,
    },
    duration: {
      type: String,
    },
    image: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model("Messages", messageSchema);


const ConnectionSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true, // Ensures no duplicate emails
    lowercase: true,
    trim: true
  },
  full_name: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: ''
  }
}, { timestamps: true });


app.post('/sendMessage/:id/:authId', async (req, res) => {

  try {
    const { text, image } = req.body;
    const { id: receiverId, authId: senderId } = req.params;
    // const senderId = req.user;

    let imageUrl = '';
    if (image) {
      // UPLOAD IMAGE TO CLOUDINARY
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }


    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl
    })

    await newMessage.save()

    // console.log(newMessage,'mmmmmm');


    // REALTIME MESSAGE FUNCTIONALITY => SOCKET.IO
    const receiverSocketId = getReceiverSocketId(receiverId);
    // const senderSocketId = getReceiverSocketId(senderId);
    io.to(receiverSocketId).emit('newMessage', newMessage);
    // io.to(senderSocketId).emit('newMessage', newMessage);

    res.status(200).json(newMessage)

  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

app.post('/sendVoice/:id/:authId', upload.single('voice'), async (req, res) => {
    try {
        const { id: receiverId, authId: senderId } = req.params;
        const duration = req.body.duration ? req.body.duration : 0;

        console.log(duration,'ddd');
        
        if (!req.file) {
            return res.status(400).json({ error: 'No voice file provided' });
        }

        // Validate file size (max 5MB)
        if (req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ error: 'Voice message too large (max 5MB)' });
        }

        // Convert buffer to stream
        const readableStream = new stream.PassThrough();
        readableStream.end(req.file.buffer);

        // Upload to Cloudinary
        const uploadResponse = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: 'video',
                    format: 'm4a',
                    folder: 'voice_messages',
                    quality: 'auto:low'
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            );
            readableStream.pipe(uploadStream);
        });

        console.log(uploadResponse.secure_url,'uploadResponse.secure_url');
        

        // Save to database
        const newMessage = new Message({
            senderId,
            receiverId,
            voice: uploadResponse.secure_url,
            duration,
            // createdAt: new Date()
        });
        await newMessage.save();

        // Emit via Socket.io
        const receiverSocketId = getReceiverSocketId(receiverId);
        const senderSocketId = getReceiverSocketId(senderId);
        if (receiverSocketId) io.to(receiverSocketId).emit('newMessage', newMessage);
        if (senderSocketId) io.to(senderSocketId).emit('newMessage', newMessage);

        res.status(200).json(newtttttttttttttttttMessage)

    } catch (error) {
        console.error('Voice upload failed:', error);
        res.status(500).json({ 
            error: 'Voice message processing failed',
            details: error.message 
        });
    }
});

app.get('/getMessage/:id/:authId', async (req, res) => {

  try {
    const { id: userToChatId, authId: myId } = req.params;
    // const myId = authId;

    // console.log(userToChatId, myId, 'mmmmmmm');


    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    // console.log(messages, 'messages');

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const AdminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: ''
    },
    password: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

app.get('/admin', async (req, res) => {

  try {



    // Fix: Use existing model if already registered
    const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

    const data = await Admin.find();

    res.status(200).json(data[0]);

  } catch (error) {
    console.log("Error in admin: ", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


app.post('/googleSignUp', async (req, res) => {
  const { email, full_name, image } = req.body;

  // console.log(email,'emailll',req.body);


  if (!email || !full_name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const Connection = mongoose.model('Connections', ConnectionSchema);

  try {
    const existingUser = await Connection.findOne({ email });

    if (existingUser) {
      // console.log('11111111111');

      return res.status(201).json({ success: false, message: 'Already created.' });
    }

    const newUser = new Connection({
      email,
      full_name: '',
      password: full_name.replace(/\s/g, ''),
      image
    });

    const savedUser = await newUser.save();

    res.status(200).json({
      success: true,
      message: 'Connected.',
      userId: savedUser._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error processing user registration' });
  }
});

app.post('/signUp', async (req, res) => {
  const { email, full_name, password } = req.body;

  // console.log(email,'emailll',req.body);


  if (!email || !full_name) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const Connection = mongoose.model('Connections', ConnectionSchema);

  try {
    const existingUser = await Connection.findOne({ email });

    if (existingUser) {
      // console.log('11111111111');

      return res.status(201).json({ success: false, message: 'Already created.' });
    }

    const newUser = new Connection({
      email,
      full_name: '',
      password
    });

    const savedUser = await newUser.save();

    res.status(200).json({
      success: true,
      message: 'Connected.',
      userId: savedUser._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error processing user registration' });
  }
});

app.get('/googleLogin', async (req, res) => {

  const { token } = req.query;

  // console.log(token,'tokennn');


  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  const Connection = mongoose.model('Connections', ConnectionSchema);

  try {
    // Verify Google Token
    const ticket = await gooClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, name } = ticket.getPayload();

    const existingUser = await Connection.findOne({ email });

    // console.log(existingUser._id,'existingUser._id');


    if (existingUser) {
      return res.status(200).json({ success: true, message: 'Connected.', userId: existingUser._id });
    } else {
      return res.status(201).json({ success: false, message: 'Not created yet.' });
    }

  } catch (err) {
    console.error('Error during Google Sign-In:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/login', async (req, res) => {
  console.log('login');

  const { email, password } = req.query;

  console.log(email, password, 'aaa');


  if (!email || !password) {
    return res.status(201).json({ error: 'All fields are required' });
  }

  const Connection = mongoose.model('Connections', ConnectionSchema);

  try {
    const existingUser = await Connection.findOne({ email, password });

    if (existingUser) {
      return res.status(200).json({ success: true, message: 'Connected.', userId: existingUser._id });
    } else {
      return res.status(201).json({ success: false, message: 'Invalid email or password.' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/adminlogin', async (req, res) => {
  // Keep the query string key as “username” (or change it if you prefer)
  const { username, password } = req.query;

  console.log('adminlogin');


  if (!username || !password) {
    return res.status(201).json({ error: 'All fields are required' });
  }

  try {
    const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

    // Match “name” in the collection to the supplied username
    const admin = await Admin.findOne({ name: username, password });

    if (!admin) {
      return res.status(201).json({ error: 'Invalid username or password' });
    }

    res.status(200).json({ message: 'Login successful', data: admin });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/getUsers', async (req, res) => {

  const Connection = mongoose.model('Connections', ConnectionSchema);

  try {
    const filteredUsers = await Connection.find().select("-password");
    return res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getUserForSidebar: ", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});



const ip = process.env.HOST
const port = process.env.PORT

server.listen(port, ip, () => {
  console.log('Server running on port 3001');
});