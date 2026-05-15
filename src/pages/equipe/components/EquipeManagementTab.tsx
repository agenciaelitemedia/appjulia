import { useState, useMemo } from "react";
import { EquipeHeader } from "./EquipeHeader";
import { EquipeSearch } from "./EquipeSearch";
import { EquipeGrid } from "./EquipeGrid";
import { EquipeMemberDialog } from "./EquipeMemberDialog";
import { DeleteMemberDialog } from "./DeleteMemberDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { useTeamMembers } from "../hooks/useEquipeData";
import { TeamMember } from "../types";

export function EquipeManagementTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const { data: members = [], isLoading } = useTeamMembers();

  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return members;
    const term = searchTerm.toLowerCase();
    return members.filter(
      (m) => m.name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term),
    );
  }, [members, searchTerm]);

  const handleNewMember = () => { setSelectedMember(null); setDialogOpen(true); };
  const handleEditMember = (m: TeamMember) => { setSelectedMember(m); setDialogOpen(true); };
  const handleDeleteMember = (m: TeamMember) => { setSelectedMember(m); setDeleteDialogOpen(true); };
  const handleResetPassword = (m: TeamMember) => { setSelectedMember(m); setResetPasswordDialogOpen(true); };

  return (
    <div className="space-y-6">
      <EquipeHeader onNewMember={handleNewMember} />
      <EquipeSearch value={searchTerm} onChange={setSearchTerm} />
      <EquipeGrid
        members={filteredMembers}
        isLoading={isLoading}
        onEdit={handleEditMember}
        onDelete={handleDeleteMember}
        onResetPassword={handleResetPassword}
      />
      <EquipeMemberDialog open={dialogOpen} onOpenChange={setDialogOpen} member={selectedMember} />
      <DeleteMemberDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} member={selectedMember} />
      <ResetPasswordDialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen} member={selectedMember} />
    </div>
  );
}