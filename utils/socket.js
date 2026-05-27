const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer, sessionMiddleware) {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: false
    }
  });

  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, (err) => {
      if (err) return next(err);

      const session = socket.request.session;
      if (!session || !session.userId) {
        return next(new Error('Unauthorized'));
      }

      if (!['admin', 'trainer'].includes(session.userRole)) {
        return next(new Error('Unauthorized'));
      }

      socket.userId = session.userId;
      socket.userRole = session.userRole;
      next();
    });
  });

  io.on('connection', (socket) => {
    socket.on('join-trainings', (trainingIds) => {
      if (!Array.isArray(trainingIds)) return;

      trainingIds.forEach((trainingId) => {
        const id = parseInt(trainingId, 10);
        if (Number.isFinite(id) && id > 0) {
          socket.join(`training:${id}`);
        }
      });
    });

    socket.on('leave-trainings', (trainingIds) => {
      if (!Array.isArray(trainingIds)) return;

      trainingIds.forEach((trainingId) => {
        const id = parseInt(trainingId, 10);
        if (Number.isFinite(id) && id > 0) {
          socket.leave(`training:${id}`);
        }
      });
    });
  });

  return io;
}

function getIo() {
  return io;
}

module.exports = {
  initSocket,
  getIo
};
