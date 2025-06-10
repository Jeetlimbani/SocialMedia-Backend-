import { formatDistanceToNow } from "date-fns";

export const formatTimeAgo = (date) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};
