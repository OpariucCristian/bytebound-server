import { MigrationInterface, QueryRunner } from 'typeorm';

export class HeroSkills1790430144237 implements MigrationInterface {
  name = 'HeroSkills1790430144237';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Any hand-made rows get their id as key, so the column can be NOT NULL.
    await queryRunner.query(`ALTER TABLE "HeroSkill" ADD "key" text`);
    await queryRunner.query(
      `UPDATE "HeroSkill" SET "key" = "id"::text WHERE "key" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "HeroSkill" ALTER COLUMN "key" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "HeroSkill" ADD "description" text`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_HeroSkill_key" ON "HeroSkill" ("key") `,
    );
    await queryRunner.query(
      `ALTER TABLE "Game" ADD "used_skill_ids" uuid array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(`ALTER TABLE "Game" ADD "active_skill_id" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "Game" DROP COLUMN "active_skill_id"`);
    await queryRunner.query(`ALTER TABLE "Game" DROP COLUMN "used_skill_ids"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_HeroSkill_key"`);
    await queryRunner.query(
      `ALTER TABLE "HeroSkill" DROP COLUMN "description"`,
    );
    await queryRunner.query(`ALTER TABLE "HeroSkill" DROP COLUMN "key"`);
  }
}
