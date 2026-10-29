// PROTOTYPE (throwaway): Variant B evaluation report dialog. Numbers are INVENTED placeholders in
// the shape the `evaluation` module will produce (Test set × Rubric version).
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { evaluationReport as rep } from "../fixture/workspace";

export function ReportDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="bg-background text-xs sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Evaluation · Rubric v{rep.rubricVersion} on the Test set ({rep.testSet} Episodes,{" "}
            {rep.descriptionFailures} description failures)
          </DialogTitle>
          <DialogDescription className="font-medium text-rose-700">
            Placeholder numbers, invented for the prototype. Scored against Reference labels only.
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>System</TableHead>
              <TableHead>False keeps</TableHead>
              <TableHead>95% CI</TableHead>
              <TableHead>Right reason</TableHead>
              <TableHead>Decided automatically</TableHead>
              <TableHead>False rejects</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rep.rows.map((r) => (
              <TableRow key={r.system} className={r.system === "Spark alone" ? "bg-violet-50" : ""}>
                <TableCell className="font-medium">{r.system}</TableCell>
                <TableCell className="tabular-nums">{r.falseKeeps}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {r.falseKeepsCI}
                </TableCell>
                <TableCell className="tabular-nums">{r.rightReason}</TableCell>
                <TableCell className="tabular-nums">{r.coverage}</TableCell>
                <TableCell className="tabular-nums">{r.falseRejects}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="text-xs font-semibold">Source ablation ($0, re-scored from the cache)</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sources</TableHead>
              <TableHead>False keeps</TableHead>
              <TableHead>Right reason</TableHead>
              <TableHead>Decided automatically</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rep.ablation.map((r) => (
              <TableRow key={r.sources}>
                <TableCell>{r.sources}</TableCell>
                <TableCell className="tabular-nums">{r.falseKeeps}</TableCell>
                <TableCell className="tabular-nums">{r.rightReason}</TableCell>
                <TableCell className="tabular-nums">{r.coverage}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
