import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/login", async (req, res) => {
  res.json({ success: true, token: "demo-token-v2" });
});

router.post("/logout", async (req, res) => {
  res.json({ success: true });
});

router.get("/me", async (req, res) => {
  res.json({ success: true, user: { id: "demo-user-id", name: "Admin", role: "super_admin" } });
});

export default router;
