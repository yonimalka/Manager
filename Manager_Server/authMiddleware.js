const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET || "yourSecretKey";

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ code: "TOKEN_INVALID", message: "Token missing" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
      return res.status(401).json({ code, message: err.message });
    }
    req.userId = decoded.userId;
    next();
  });
};

module.exports = authMiddleware;
