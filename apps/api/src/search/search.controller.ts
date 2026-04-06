import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards';
import { SearchService } from './search.service';
import type { SearchResponseDto } from '@vineroot/shared-types';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private searchService: SearchService) {}

  /** Global search: tasks (title/description/comments), projects, sections, tags; optional `workspaceId` narrows scope. */
  @Get('search')
  async search(
    @Request() req: { user: { userId: string } },
    @Query('q') q?: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('limit') limitStr?: string,
  ): Promise<SearchResponseDto> {
    const parsed = Number.parseInt(limitStr ?? '20', 10);
    const limit = Number.isFinite(parsed) ? parsed : 20;
    return this.searchService.search(req.user.userId, q ?? '', workspaceId, limit);
  }
}
