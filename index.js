const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const multer = require('multer');

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// Serve static files (html, css, js)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Setup multer storage for media upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads');
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

// Upload route
app.post('/upload', upload.single('media'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const mimeType = req.file.mimetype;

  console.log('File uploaded:', fileUrl, 'MIME:', mimeType);

  res.status(200).json({ 
    url: fileUrl,
    mimeType: mimeType
  });
});

// Chatroom variables
let numUsers = 0;

io.on('connection', (socket) => {
  let addedUser = false;

  console.log('A user connected');

  // Receive new chat message (with or without media)
  socket.on('new message', (data) => {
    console.log('new message:', data);

    // Broadcast to all other clients
    socket.broadcast.emit('new message', {
      username: data.username,
      message: data.message,
      timestamp: data.timestamp,
      hasMedia: data.hasMedia ?? false,
      media: data.media ?? null,
      mimeType: data.mimeType ?? null,  
      messageType: data.messageType ?? 'MESSAGE'
    });

    console.log('new message emitted to other clients');

    
  });

  // User adds username
  socket.on('add user', (username) => {
    if (addedUser) return;

    socket.username = username;
    ++numUsers;
    addedUser = true;

    socket.emit('login', { numUsers: numUsers });

    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });

    console.log('A user joined',socket.username);

  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', {
      username: data
    });
  });

  socket.on('stop typing', (data) => {
    socket.broadcast.emit('stop typing', {
      username: data
    });
  });

  // User disconnect
  socket.on('disconnect', () => {
    if (addedUser) {
      --numUsers;


      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });

      console.log('A user disconnected', socket.username);

    }

  });
});
