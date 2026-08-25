import { config } from "dotenv";
import { resolve } from "path";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { corsOrigin } from "./common/allowed-origins";

config({ path: resolve(process.cwd(), ".env") });

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    // Corps JSON plafonné : sans limite, un seul POST peut saturer la mémoire.
    bodyParser: true,
  });

  const bodyLimit = process.env.BODY_LIMIT || "100kb";
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  const origin = corsOrigin();
  app.enableCors({
    origin,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400,
  });

  if (origin === true) {
    logger.warn(
      "FRONTEND_URL non défini : CORS ouvert à toutes les origines. À restreindre en production.",
    );
  }

  // Rejette tout champ non déclaré dans les DTO et valide les types reçus.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  app.enableShutdownHooks();

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  logger.log(`Backend démarré sur le port ${port}`);
}

void bootstrap();
