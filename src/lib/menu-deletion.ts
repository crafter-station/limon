import "server-only";

import {
  claimAbandonedMenuUploadBatch,
  claimMenuDeletionJob,
  completeMenuDeletion,
  enqueueExpiredMenuGrants,
  failMenuDeletion,
  getDeletionBlobUrls,
  setMenuUploadBatchStatus,
} from "@/lib/menu-database";
import {
  deletePrivateMenuBlobs,
  deletePrivateMenuUploadBatch,
} from "@/lib/menu-storage";

async function runNextAbandonedUploadDeletion() {
  const batch = await claimAbandonedMenuUploadBatch();
  if (!batch) return false;
  try {
    await deletePrivateMenuUploadBatch(batch.restaurantId, batch.id);
    await setMenuUploadBatchStatus(batch.id, "cleaned");
    return true;
  } catch (error) {
    await setMenuUploadBatchStatus(
      batch.id,
      "cleanup_pending",
      error instanceof Error ? error.message : "Upload cleanup failed.",
    );
    return false;
  }
}

export async function runNextMenuDeletion(rightsGrantId?: string) {
  const job = await claimMenuDeletionJob(rightsGrantId);
  if (!job) return false;
  try {
    const urls = await getDeletionBlobUrls(job.rightsGrantId);
    await deletePrivateMenuBlobs(urls);
    return completeMenuDeletion(job.id, job.rightsGrantId, job.leaseToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Menu deletion failed.";
    await failMenuDeletion(job.id, job.leaseToken, message);
    return false;
  }
}

export async function runMenuRetentionSweep(maxJobs = 10) {
  await enqueueExpiredMenuGrants();
  let completed = 0;
  for (let index = 0; index < maxJobs; index += 1) {
    if (!(await runNextAbandonedUploadDeletion())) break;
    completed += 1;
  }
  for (let index = 0; index < maxJobs; index += 1) {
    if (!(await runNextMenuDeletion())) break;
    completed += 1;
  }
  return completed;
}
