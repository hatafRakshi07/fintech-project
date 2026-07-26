import { Router, type IRouter } from "express";

const router: IRouter = Router();

const defaultUser = {
  id: "demo-user-id",
  name: "Admin User",
  email: "admin@example.com",
  role: "super_admin",
  roleName: "Super Admin"
};

router.post("/login", async (req, res) => {
  res.json({
    success: true,
    token: "demo-token-v2",
    user: defaultUser,
    ...defaultUser
  });
});

router.post("/logout", async (req, res) => {
  res.json({ success: true });
});

router.get("/me", async (req, res) => {
  res.json({
    success: true,
    user: defaultUser,
    ...defaultUser
  });
});

export default router;
