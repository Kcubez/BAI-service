import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { messagesApi, type MessagesParams } from "@/lib/api";
import { toast } from "sonner";

export function useMessages(params: MessagesParams = {}) {
  return useQuery({
    queryKey: ["messages", params],
    queryFn: () => messagesApi.list(params),
    placeholderData: (prev) => prev,
    staleTime: 15 * 1000,
    refetchIntervalInBackground: false,
    refetchInterval: 30 * 1000,
  });
}

export function useMessageStats() {
  return useQuery({
    queryKey: ["message-stats"],
    queryFn: () => messagesApi.stats(),
    staleTime: 30 * 1000,
    refetchIntervalInBackground: false,
    refetchInterval: 60 * 1000,
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => messagesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      queryClient.invalidateQueries({ queryKey: ["message-stats"] });
      queryClient.invalidateQueries({ queryKey: ["senders"] });
      toast.success("Message deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete message");
    },
  });
}
