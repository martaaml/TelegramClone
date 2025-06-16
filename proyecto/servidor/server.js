const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Lista de avatares disponibles
const imagenes = ['avatar1.png', 'avatar2.png', 'avatar3.png', 'avatar4.png'];

// Usuarios conectados
const users = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

// Ruta login por metodo GET - sirve archivo login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Ruta login (POST) - procesa login y redirige a /chat
app.post('/chat', (req, res) => {
  const { name, status, avatar } = req.body;

  // Validar datos
  if (!name || !status || !avatar || !imagenes.includes(avatar)) {
    return res.redirect('/');
  }

  //Redireccionar a /chat con los datos del usuario
  const query = `?name=${encodeURIComponent(name)}&status=${encodeURIComponent(status)}&avatar=${encodeURIComponent(avatar)}`;
  res.redirect('/chat' + query);
});

// Ruta chat (GET) - sirve archivo chat.html
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Socket.IO
io.on('connection', (socket) => {

  socket.on('join', (user) => {
    users.set(socket.id, user);

    // Enviar lista actualizada a todos
    io.emit('user-list', Array.from(users.values()));

    // Notificar a todos menos al que acaba de unirse
    socket.broadcast.emit('user-joined', `${user.name} se ha unido al chat.`);
  });

  socket.on('message', (text) => {
    const user = users.get(socket.id);
    if (!user) return;

    io.emit('message', { user, text });
  });

  socket.on('private-message', ({ to, text }) => {
    const fromUser = users.get(socket.id);
    if (!fromUser) return;

    // Buscar el socket ID del destinatario según su nombre
    let toSocketId = null;
    for (let [id, u] of users.entries()) {
      if (u.name === to) {
        toSocketId = id;
        break;
      }
    }

    if (!toSocketId) {
      // Si no está conectado, enviamos un mensaje de error al emisor
      socket.emit('private-message', { from: "Sistema", text: `El usuario ${to} no está conectado.` });
      return;
    }

    // Enviar mensaje privado solo al destinatario
    io.to(toSocketId).emit('private-message', { from: fromUser.name, text });
  });

  socket.on('typing', (isTyping) => {
    const user = users.get(socket.id);
    if (!user) return;

    // Avisar a todos menos a quien está escribiendo
    socket.broadcast.emit('typing', { user: user.name, typing: isTyping });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);

    // Actualizar lista para todos
    io.emit('user-list', Array.from(users.values()));

    // Avisar a todos que alguien salió
    io.emit('user-left', `${user.name} ha salido del chat.`);
  });
});

// Puerto
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
