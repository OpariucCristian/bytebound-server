import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1790332077194 implements MigrationInterface {
  name = 'InitialSchema1790332077194';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "QuestionPoolAnswer" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "questionId" uuid, "text" text, "isCorrect" boolean DEFAULT false, "id" uuid NOT NULL DEFAULT gen_random_uuid(), CONSTRAINT "PK_1cb6b9a481359218fe2b351e5db" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "Level" ("lvl" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "neededXp" integer DEFAULT '0', CONSTRAINT "PK_b969beffbf5c4ba8d6a918c0418" PRIMARY KEY ("lvl"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "HeroSkill" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" text, "effect_type" integer, "unlock_at_lvl" integer, "hero_id" uuid, CONSTRAINT "PK_a11560fd6aac79ea529be23b2f8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "Hero" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" text NOT NULL, "base_health" integer NOT NULL, "base_attack" integer NOT NULL, "description" text NOT NULL, "sprite_key" text NOT NULL, CONSTRAINT "PK_c3769b6c59303529ebfe9a49b54" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "Player" ("created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "uid" text NOT NULL, "lvl" integer NOT NULL DEFAULT '1', "xp" integer NOT NULL DEFAULT '0', "user_name" text NOT NULL, "hero_id" uuid, CONSTRAINT "PK_319ac14f2ed913839e7c80b027c" PRIMARY KEY ("uid"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "GameStats" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "player_id" text NOT NULL, "correct_answers" integer NOT NULL DEFAULT '0', "correct_answers_streak" integer NOT NULL DEFAULT '0', "correct_answers_streak_max" integer NOT NULL DEFAULT '0', "wrong_answers" integer NOT NULL DEFAULT '0', "xp_gained" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "game_id" uuid NOT NULL, CONSTRAINT "REL_ff4ddf47797f4b30ba802ba3cf" UNIQUE ("game_id"), CONSTRAINT "PK_a634a22ab6ed22478b4458e6100" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "Enemy" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" text NOT NULL, "base_health" integer NOT NULL, "base_attack" integer NOT NULL, "difficulty" integer NOT NULL, "sprite_key" text NOT NULL, CONSTRAINT "PK_5e9c39e59aa008ebd251a75a9f4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "Game" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" text NOT NULL DEFAULT 'endless', "category" text NOT NULL DEFAULT 'dsa', "currentQuestionId" uuid, "difficulty" integer NOT NULL DEFAULT '1', "playerId" text NOT NULL, "isCurrentQuestionAnswered" boolean NOT NULL DEFAULT false, "playerLives" integer NOT NULL, "enemy_lives" integer NOT NULL, "gameState" integer NOT NULL DEFAULT '0', "xpGained" integer NOT NULL DEFAULT '0', "currentQuestionTimestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() AT TIME ZONE 'utc'), "questionSeconds" integer NOT NULL DEFAULT '10', "enemy_id" uuid, CONSTRAINT "PK_cce0ee17147c1830d09c19d4d56" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "GameQuestions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "game_id" uuid NOT NULL, "question_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_078c841669b86a5d8c5d744ebf2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "QuestionPool" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "text" text, "category" text DEFAULT 'dsa', "difficulty" integer DEFAULT '1', CONSTRAINT "PK_0ea9d168e0efcecf2f8fe61603b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "QuestionPoolAnswer" ADD CONSTRAINT "FK_ea50d8a6a7859d7b0136f68fd1b" FOREIGN KEY ("questionId") REFERENCES "QuestionPool"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "HeroSkill" ADD CONSTRAINT "FK_085af040260c7c56c7a8c8285a6" FOREIGN KEY ("hero_id") REFERENCES "Hero"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Player" ADD CONSTRAINT "FK_d64ac09d644c6394fd2548e3bba" FOREIGN KEY ("hero_id") REFERENCES "Hero"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Player" ADD CONSTRAINT "FK_2e0f0428a9d66cd7c49923a98d9" FOREIGN KEY ("lvl") REFERENCES "Level"("lvl") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "GameStats" ADD CONSTRAINT "FK_ff4ddf47797f4b30ba802ba3cfa" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "GameStats" ADD CONSTRAINT "FK_9f0ca2ce269973c333ced2a69b6" FOREIGN KEY ("player_id") REFERENCES "Player"("uid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Game" ADD CONSTRAINT "FK_064b25f02e9265e93f8040875cb" FOREIGN KEY ("currentQuestionId") REFERENCES "QuestionPool"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Game" ADD CONSTRAINT "FK_10f610973ace2bacdd80fe96c94" FOREIGN KEY ("playerId") REFERENCES "Player"("uid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Game" ADD CONSTRAINT "FK_ecc9c33c24e0b48d19c4c98e3a8" FOREIGN KEY ("enemy_id") REFERENCES "Enemy"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "GameQuestions" ADD CONSTRAINT "FK_6d87d40c05a0d096193d258eceb" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "GameQuestions" ADD CONSTRAINT "FK_d15b9f357e06d6a5415174cd7f5" FOREIGN KEY ("question_id") REFERENCES "QuestionPool"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "GameQuestions" DROP CONSTRAINT "FK_d15b9f357e06d6a5415174cd7f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "GameQuestions" DROP CONSTRAINT "FK_6d87d40c05a0d096193d258eceb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Game" DROP CONSTRAINT "FK_ecc9c33c24e0b48d19c4c98e3a8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Game" DROP CONSTRAINT "FK_10f610973ace2bacdd80fe96c94"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Game" DROP CONSTRAINT "FK_064b25f02e9265e93f8040875cb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "GameStats" DROP CONSTRAINT "FK_9f0ca2ce269973c333ced2a69b6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "GameStats" DROP CONSTRAINT "FK_ff4ddf47797f4b30ba802ba3cfa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Player" DROP CONSTRAINT "FK_2e0f0428a9d66cd7c49923a98d9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Player" DROP CONSTRAINT "FK_d64ac09d644c6394fd2548e3bba"`,
    );
    await queryRunner.query(
      `ALTER TABLE "HeroSkill" DROP CONSTRAINT "FK_085af040260c7c56c7a8c8285a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "QuestionPoolAnswer" DROP CONSTRAINT "FK_ea50d8a6a7859d7b0136f68fd1b"`,
    );
    await queryRunner.query(`DROP TABLE "QuestionPool"`);
    await queryRunner.query(`DROP TABLE "GameQuestions"`);
    await queryRunner.query(`DROP TABLE "Game"`);
    await queryRunner.query(`DROP TABLE "Enemy"`);
    await queryRunner.query(`DROP TABLE "GameStats"`);
    await queryRunner.query(`DROP TABLE "Player"`);
    await queryRunner.query(`DROP TABLE "Hero"`);
    await queryRunner.query(`DROP TABLE "HeroSkill"`);
    await queryRunner.query(`DROP TABLE "Level"`);
    await queryRunner.query(`DROP TABLE "QuestionPoolAnswer"`);
  }
}
