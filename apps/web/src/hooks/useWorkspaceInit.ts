import { useEffect } from 'react';
import { useWorkspaces } from './useWorkspaces';
import { useWorkspaceStore } from '../stores/workspace.store';

/** Ensures a valid current workspace is selected after workspaces load. */
export function useWorkspaceInit() {
  const { data: workspaces, isSuccess } = useWorkspaces();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();

  useEffect(() => {
    if (!isSuccess || !workspaces?.length) return;
    const valid =
      currentWorkspace && workspaces.some((w) => w.id === currentWorkspace.id);
    if (!valid) {
      setCurrentWorkspace(workspaces[0]);
    }
  }, [isSuccess, workspaces, currentWorkspace, setCurrentWorkspace]);
}
