const { io } = require("socket.io-client");

const socket2 = io("http://localhost:5000", {
  auth: {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5Y2ZjYTU1OWY5NjdmOTM2NTg0ZjFjMSIsImlhdCI6MTc3NTIyNzAzMywiZXhwIjoxNzc1MjI3OTMzfQ.qPx-G9TL_N_elz_H8LazHZycbPVCxKaH--U2llUGa-E"
  }
});

socket2.on("connect", () => {
  console.log("Client2 connected");

  socket2.emit("join-document", "69cfcabc9f967f936584f1c7");

  setTimeout(() => {
    socket2.emit("send-changes", {
      documentId: "69cfcabc9f967f936584f1c7", // ✅ SAME ID
      content: "Hello from client2 🚀"
    });
  }, 2000);
});

socket2.on("connect_error", (err) => {
  console.log("Client2 error:", err.message);
});

// keep alive
setInterval(() => {}, 1000);
