import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Scale } from 'lucide-react';
import { useContractInfo } from '../hooks/useContractInfo';
import { ContractInfoContent } from './ContractInfoContent';

interface ContractInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappNumber: string;
  codAgent: string;
  contactName?: string;
}

const ContractInfoDialog = React.forwardRef<HTMLDivElement, ContractInfoDialogProps>(
  ({ open, onOpenChange, whatsappNumber, codAgent, contactName }, ref) => {
    const { data: contractInfo, isLoading } = useContractInfo(whatsappNumber, codAgent, open);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent ref={ref} className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Detalhes do Contrato
            </DialogTitle>
          </DialogHeader>
          <ContractInfoContent contractInfo={contractInfo} isLoading={isLoading} contactName={contactName} />
        </DialogContent>
      </Dialog>
    );
  }
);

ContractInfoDialog.displayName = 'ContractInfoDialog';

export { ContractInfoDialog };
