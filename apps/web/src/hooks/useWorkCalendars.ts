import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  CreateWorkCalendarRequest,
  UpdateWorkCalendarRequest,
  WorkCalendarDto,
} from '@vineroot/shared-types';

export function workCalendarsQueryKey(workspaceId: string | undefined) {
  return ['work-calendars', workspaceId] as const;
}

export function useWorkCalendars(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workCalendarsQueryKey(workspaceId),
    queryFn: async () => {
      const { data } = await api.get<WorkCalendarDto[]>(
        `/workspaces/${workspaceId}/work-calendars`,
      );
      return data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateWorkCalendar(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateWorkCalendarRequest) => {
      const { data } = await api.post<WorkCalendarDto>(
        `/workspaces/${workspaceId}/work-calendars`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      if (workspaceId) qc.invalidateQueries({ queryKey: workCalendarsQueryKey(workspaceId) });
    },
  });
}

export function useUpdateWorkCalendar(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      calendarId,
      body,
    }: {
      calendarId: string;
      body: UpdateWorkCalendarRequest;
    }) => {
      const { data } = await api.patch<WorkCalendarDto>(
        `/workspaces/${workspaceId}/work-calendars/${calendarId}`,
        body,
      );
      return data;
    },
    onSuccess: () => {
      if (workspaceId) qc.invalidateQueries({ queryKey: workCalendarsQueryKey(workspaceId) });
    },
  });
}

export function useDeleteWorkCalendar(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calendarId: string) => {
      await api.delete(`/workspaces/${workspaceId}/work-calendars/${calendarId}`);
    },
    onSuccess: () => {
      if (workspaceId) qc.invalidateQueries({ queryKey: workCalendarsQueryKey(workspaceId) });
    },
  });
}
