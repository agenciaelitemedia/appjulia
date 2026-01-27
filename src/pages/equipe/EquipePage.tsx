import { useState, useMemo } from "react";
import { EquipeHeader } from "./components/EquipeHeader";
import { EquipeSearch } from "./components/EquipeSearch";
import { EquipeGrid } from "./components/EquipeGrid";
import { EquipeMemberDialog } from "./components/EquipeMemberDialog";
import { DeleteMemberDialog } from "./components/DeleteMemberDialog";
import { useTeamMembers } from "./hooks/useEquipeData";
import { TeamMember } from "./types";

export default function EquipePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const { data: members = [], isLoading } = useTeamMembers();

  // Filter members by search term
  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return members;

    const term = searchTerm.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term)
    );
  }, [members, searchTerm]);

  const handleNewMember = () => {
    setSelectedMember(null);
    setDialogOpen(true);
  };

  const handleEditMember = (member: TeamMember) => {
    setSelectedMember(member);
    setDialogOpen(true);
  };

  const handleDeleteMember = (member: TeamMember) => {
    setSelectedMember(member);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <EquipeHeader onNewMember={handleNewMember} />

      <EquipeSearch value={searchTerm} onChange={setSearchTerm} />

      <EquipeGrid
        members={filteredMembers}
        isLoading={isLoading}
        onEdit={handleEditMember}
        onDelete={handleDeleteMember}
      />

      <EquipeMemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={selectedMember}
      />

      <DeleteMemberDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        member={selectedMember}
      />
    </div>
  );
}
