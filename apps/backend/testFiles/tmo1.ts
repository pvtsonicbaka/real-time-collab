const { io } = require("socket.io-client");

const socket1 = io("http://localhost:5000", {
  auth: {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5Y2ZjYTQ0OWY5NjdmOTM2NTg0ZjFiZSIsImlhdCI6MTc3NTIyNjk4MiwiZXhwIjoxNzc1MjI3ODgyfQ._NzaZD8ZsZlmjm63xG7QdDMG8r9RFGZL5Obf1K9qw28"
  }
});

socket1.on("connect", () => {
  console.log("Client1 connected");

  socket1.emit("join-document", "69cfcabc9f967f936584f1c7");
});

socket1.on("receive-changes", (data) => {
  console.log("Client1 received:", data);
});

socket1.on("connect_error", (err) => {
  console.log("Client1 error:", err.message);
});

// keep alive
setInterval(() => {}, 1000);
