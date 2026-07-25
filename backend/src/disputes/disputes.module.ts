import { Module } from "@nestjs/common";
import { CaseStatusService } from "./case-status.service";
import { DisputesController } from "./disputes.controller";
import { DisputesService } from "./disputes.service";
import { MerchantCasesController } from "./merchant-cases.controller";
import { MerchantCasesService } from "./merchant-cases.service";
import { PolicyEvaluationService } from "./policy-evaluation.service";
import { PolicyRequirementsService } from "./policy-requirements.service";

@Module({
  controllers: [DisputesController, MerchantCasesController],
  providers: [
    DisputesService,
    MerchantCasesService,
    PolicyRequirementsService,
    PolicyEvaluationService,
    CaseStatusService,
  ],
})
export class DisputesModule {}
