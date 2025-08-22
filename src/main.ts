import 'dotenv/config';
import {
  ClassSerializerInterceptor,
  ValidationPipe,
  VersioningType,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import validationOptions from './utils/validation-options';
import { AllConfigType } from './config/config.type';
import { ResolvePromisesInterceptor } from './utils/serializer.interceptor';

async function bootstrap() {
  const logger = new Logger('Main');

  const app = await NestFactory.create(AppModule, { cors: true });
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  const configService = app.get(ConfigService<AllConfigType>);

  app.enableShutdownHooks();
  app.setGlobalPrefix(
    configService.getOrThrow('app.apiPrefix', { infer: true }),
    {
      exclude: ['/'],
    },
  );
  app.enableVersioning({
    type: VersioningType.URI,
  });
  app.useGlobalPipes(new ValidationPipe(validationOptions));
  app.useGlobalInterceptors(
    // ResolvePromisesInterceptor is used to resolve promises in responses because class-transformer can't do it
    // https://github.com/typestack/class-transformer/issues/549
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  const options = new DocumentBuilder()
    .setTitle('API')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth()
    .addGlobalParameters({
      in: 'header',
      required: false,
      name: process.env.APP_HEADER_LANGUAGE || 'x-custom-lang',
      schema: {
        example: 'en',
      },
    })
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document);

  const port = configService.getOrThrow('app.port', { infer: true });

  await app.listen(port);

  logger.log(`Server is running on port http://localhost:${port}`);
  logger.log(`Swagger is running on port http://localhost:${port}/docs`);
}
void bootstrap();

// private isRateLimitError(error: any): boolean {
//   const errorMessage = error?.message?.toLowerCase() || '';
//   return errorMessage.includes('rate limit') ||
//          errorMessage.includes('too many requests') ||
//          errorMessage.includes('429') ||
//          error?.status === 429;
// }

// private calculateRetryDelay(retryCount: number): number {
//   const baseRetryDelay = this.configService.get('sui.baseRetryDelayMs') || 1000;
//   const maxRetryDelay = this.configService.get('sui.maxRetryDelayMs') || 30000;

//   // Exponential backoff with jitter
//   const delay = Math.min(
//     baseRetryDelay * Math.pow(2, retryCount),
//     maxRetryDelay
//   );
//   // Add jitter (±20%)
//   const jitter = delay * 0.2 * (Math.random() - 0.5);
//   return Math.max(delay + jitter, 1000);
// }
