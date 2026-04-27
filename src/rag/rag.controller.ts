import { Body, Controller, Post } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
    constructor(private readonly ragService: RagService) { }

    @Post('load')
    loadDocuments(
        @Body() body: { documents: { id: string; content: string; source?: string }[] },
    ) {
        return this.ragService.loadDocuments(body.documents)
    }
}
