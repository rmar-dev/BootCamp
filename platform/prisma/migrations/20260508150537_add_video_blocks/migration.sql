-- AlterEnum
ALTER TYPE "BlockKind" ADD VALUE 'video';

-- AlterTable
ALTER TABLE "Block" ADD COLUMN     "videoDescription" TEXT,
ADD COLUMN     "videoDurationLabel" TEXT,
ADD COLUMN     "videoPosterUrl" TEXT,
ADD COLUMN     "videoTitle" TEXT,
ADD COLUMN     "videoUrl" TEXT;
