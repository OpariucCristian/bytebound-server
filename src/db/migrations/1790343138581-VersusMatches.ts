import { MigrationInterface, QueryRunner } from 'typeorm';

export class VersusMatches1790343138581 implements MigrationInterface {
  name = 'VersusMatches1790343138581';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "MatchPlayer" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "match_id" uuid NOT NULL, "player_id" text NOT NULL, "hero_id" uuid, "lives_left" integer NOT NULL, "correct_answers" integer NOT NULL DEFAULT '0', "wrong_answers" integer NOT NULL DEFAULT '0', "xp_gained" integer NOT NULL DEFAULT '0', "result" text NOT NULL, CONSTRAINT "PK_cebd11334386470fc221731674c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_02e9645c9b2775f2bb2e14c4e6" ON "MatchPlayer" ("player_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "Match" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "finished_at" TIMESTAMP WITH TIME ZONE NOT NULL, "mode" text NOT NULL DEFAULT 'endless', "category" text NOT NULL, "source" text NOT NULL, "end_reason" text NOT NULL, "rounds" integer NOT NULL DEFAULT '0', "winner_id" text, CONSTRAINT "PK_6613246d3949e391f7a62aca368" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "MatchPlayer" ADD CONSTRAINT "FK_de43e3ec65fcce8865aa05ca92b" FOREIGN KEY ("match_id") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "MatchPlayer" ADD CONSTRAINT "FK_02e9645c9b2775f2bb2e14c4e68" FOREIGN KEY ("player_id") REFERENCES "Player"("uid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "MatchPlayer" ADD CONSTRAINT "FK_4cbac0d149150877f893e963725" FOREIGN KEY ("hero_id") REFERENCES "Hero"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "Match" ADD CONSTRAINT "FK_9e6e7fee4ed8da265b1cd9656d2" FOREIGN KEY ("winner_id") REFERENCES "Player"("uid") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Match" DROP CONSTRAINT "FK_9e6e7fee4ed8da265b1cd9656d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "MatchPlayer" DROP CONSTRAINT "FK_4cbac0d149150877f893e963725"`,
    );
    await queryRunner.query(
      `ALTER TABLE "MatchPlayer" DROP CONSTRAINT "FK_02e9645c9b2775f2bb2e14c4e68"`,
    );
    await queryRunner.query(
      `ALTER TABLE "MatchPlayer" DROP CONSTRAINT "FK_de43e3ec65fcce8865aa05ca92b"`,
    );
    await queryRunner.query(`DROP TABLE "Match"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_02e9645c9b2775f2bb2e14c4e6"`,
    );
    await queryRunner.query(`DROP TABLE "MatchPlayer"`);
  }
}
