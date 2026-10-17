-- Enable a separate shared Georgian Wordle board without changing English Wordle or Sudoku.
alter table public.shared_games
  drop constraint if exists shared_games_game_type_check;

alter table public.shared_games
  add constraint shared_games_game_type_check
  check (game_type in ('wordle', 'wordle-ka', 'sudoku'));
