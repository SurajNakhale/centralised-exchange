import bcrypt from "bcrypt";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";
import { authSchema } from "../types/auth-schema.js";
import { createToken } from "../utils/auth.js";
import { sendValidationError } from "../utils/validation.js";

export async function signup(req: Request, res: Response): Promise<void> {
  const parsedBody = authSchema.safeParse(req.body);
  if (!parsedBody.success) {
    sendValidationError(res, parsedBody.error);
    return;
  }

  const { username, password } = parsedBody.data;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    res.status(201).json({
      token: createToken({ userId: user.id }),
      userId: user.id,
      username: user.username,
    });
  } catch {
    res.status(409).json({ error: "username already exists" });
  }
}

export async function signin(req: Request, res: Response, next: NextFunction): Promise<void> {
  //TODO: Implement signin logic
  const parsedBody = authSchema.safeParse(req.body);
  if(!parsedBody.success) {
    sendValidationError(res, parsedBody.error);
    return;
  }

  const { username, password } = parsedBody.data;

  try{
    const userExist = await prisma.user.findUnique({
      where: {
        username
      }, 
      select: {
        id: true,
        username: true,
        password: true,
      }
    })

    if(!userExist) {
      res.status(403).json({error: "user does not exists signup!"});
      return;
    };

    const passMatch = await bcrypt.compare(password, userExist.password);

    if(!passMatch){
      res.status(401).json({error: "invalid username or password"});
    }

    res.status(200).json({
      token: createToken({userId: userExist.id}),
      userId: userExist,
      username: userExist.username
    })
  }
  catch(err){
    next(err);
  }
}
