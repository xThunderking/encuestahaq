-- CreateTable
CREATE TABLE `survey_responses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `submissionId` VARCHAR(36) NOT NULL,
    `surveyCode` VARCHAR(100) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `answers` JSON NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `survey_responses_submissionId_key`(`submissionId`),
    INDEX `survey_responses_surveyCode_submittedAt_idx`(`surveyCode`, `submittedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
